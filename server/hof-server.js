#!/usr/bin/env node
/* 오늘의 명전 서버 — 외부 패키지 없이 Node.js 기본 모듈만 사용
   POST /toauthors → 의견 보내기(게임 허브의 확성기). 받은 의견을 이 폴더의 feedback.jsonl에 한 줄씩 쌓는다
   GET  /health   → {ok:true}
   GET  /hof  → {포지션: [기록 ...]}  (포지션별 레전드 점수 탑10, 24시간 안의 기록만)
   POST /hof  → 기록 1개 등록. 그 포지션 탑10에 들 때만 저장하고, 결과와 최신 목록을 돌려준다
   위조 방지: 허용된 사이트(Origin)에서 온 등록만 받고, 레전드 점수·등급은 클라이언트 값을 믿지 않고
   보내온 수상·기록 목록으로 서버가 다시 계산한다(규칙은 게임 코드 index.html에서 그대로 읽는다)
   설정(환경 변수): PORT(기본 3000, Cloudflare Tunnel이 가리키는 포트) · HOF_FILE(기본 이 폴더의 hof-data.json)
                   ALLOW_ORIGIN(기본 www.zerotows.com·zerotows.com·jaminieya.github.io, 쉼표로 여러 개, * 는 모두 허용)
                   GAME_HTML(기본 ../index.html) */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const PORT = +process.env.PORT || 3000;
const FEEDBACK_FILE = process.env.FEEDBACK_FILE || path.join(__dirname, 'feedback.jsonl');
const FILE = process.env.HOF_FILE || path.join(__dirname, 'hof-data.json');
const ORIGINS = (process.env.ALLOW_ORIGIN || 'https://www.zerotows.com,https://zerotows.com,https://jaminieya.github.io').split(',').map(s => s.trim()).filter(Boolean);
const GAME_HTML = process.env.GAME_HTML || path.join(__dirname, '..', 'index.html');
const TTL = 24 * 3600 * 1000;
const TOP = 10;
const POS = ['C', 'CI', 'MI', 'OF', 'DH', 'SP', 'MR', 'CL'];
const MAX_BODY = 4 * 1024;
const RATE = { max: 10, win: 60 * 1000 }; // IP당 1분에 등록 10번까지

/* ----- 레전드 점수 규칙: 게임 코드에서 PTS·TEAM_AWARD·FEAT_KEYS·achCat·LEGEND·gradeOf 정의를 잘라 와 실행한다 ----- */
function grab(src, head) {
  const i = src.indexOf(head);
  if (i < 0) throw new Error('index.html에서 규칙을 찾지 못했다: ' + head);
  let d = 0, q = null, opened = false;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '/' && src[j + 1] === '*') { j = src.indexOf('*/', j + 2) + 1; continue; }
    if ('([{'.includes(c)) { d++; opened = true; } else if (')]}'.includes(c)) d--;
    if (d === 0 && (c === ';' || (opened && c === '}' && head.startsWith('function')))) return src.slice(i, j + 1);
  }
  throw new Error('규칙 끝을 찾지 못했다: ' + head);
}
const RULES = (() => {
  const src = fs.readFileSync(GAME_HTML, 'utf8');
  const code = ['const PTS=', 'const TEAM_AWARD=', 'const FEAT_KEYS=', 'const achCat=', 'const LEGEND=', 'function gradeOf('].map(h => grab(src, h)).join('\n');
  return vm.runInNewContext(code + '\n;({PTS,TEAM_AWARD,FEAT_KEYS,achCat,LEGEND,gradeOf})', {});
})();
/* 수상 하나를 몇 번까지 인정할지: 리그 수상은 그 리그 1군 시즌 수, 국제대회는 4년에 한 번꼴,
   경기 단위 기록(그랜드 슬램 등)은 시즌당 10번, 데뷔·통산 기록은 1번 */
const PER_GAME = /퍼펙트|노히트|완봉|완투|사이클링|3홈런|그랜드 슬램|끝내기/;
function capFor(k, kbo, mlb) {
  const yrs = kbo + mlb;
  if (/데뷔| 통산 /.test(k)) return 1;
  if (PER_GAME.test(k)) return yrs * 10;
  if (/^(KBO |한국시리즈|최동원상|일구상)/.test(k)) return kbo;
  if (/^(MLB |월드시리즈|사이영상|골드글러브|플래티넘|행크 에런|올MLB|DH 올해)/.test(k)) return mlb;
  if (/^고교/.test(k)) return 3;
  if (/^대학/.test(k)) return 4;
  if (/^U-18/.test(k)) return 2;
  if (/^U-23/.test(k)) return 3;
  if (/WBC|올림픽|프리미어12|아시안게임/.test(k)) return Math.ceil((yrs + 4) / 4);
  return RULES.FEAT_KEYS.has(k) ? yrs : yrs + 2;
}
/* index.html의 scoreParts()와 같은 계산. 수상 횟수는 capFor 범위까지만 인정한다 */
function legend(ach, kbo, mlb, fame) {
  const { PTS, achCat, LEGEND, gradeOf } = RULES, raw = { team: 0, personal: 0, feat: 0 };
  for (const [k, v] of Object.entries(ach && typeof ach === 'object' ? ach : {})) {
    if (!(k in PTS)) continue;
    const cap = capFor(k, kbo, mlb);
    raw[achCat(k)] += PTS[k] * int(v, 0, cap);
  }
  let score = Math.round(Math.min(99, kbo * 2.5 + mlb * 4.5 + Math.min(fame, 20) * 1.5));
  for (const c in LEGEND) score += Math.round(LEGEND[c].cap * (1 - Math.exp(-raw[c] / LEGEND[c].k)));
  score = Math.min(999, score);
  return { score, grade: gradeOf(score)[0] };
}

/* ----- 저장소: 메모리에 두고 바뀔 때마다 파일에 쓴다 (임시 파일에 쓴 뒤 이름 바꾸기) ----- */
let board = {};
function load() {
  try { board = JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}; } catch (e) { board = {}; }
  prune();
}
function persist() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(board));
  fs.renameSync(tmp, FILE);
}
/* 24시간 지난 기록을 빼고, 포지션마다 점수순 탑10만 남긴다 */
function prune() {
  const now = Date.now();
  for (const p of POS) {
    board[p] = (board[p] || []).filter(e => now - e.t < TTL).sort((a, b) => b.score - a.score).slice(0, TOP);
  }
  for (const k of Object.keys(board)) if (!POS.includes(k)) delete board[k];
}

/* ----- 입력 검사: 클라이언트 값은 믿지 않고 필요한 필드만 범위 안으로 받는다 ----- */
const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n) : '');
const int = (v, lo, hi) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : lo);
function clean(b) {
  if (!b || typeof b !== 'object') return null;
  const pos = str(b.pos, 4), name = str(b.name, 20);
  if (!POS.includes(pos) || !name) return null;
  const kbo = int(b.kbo, 0, 30), mlb = int(b.mlb, 0, 30);
  if (kbo + mlb > 30) return null;
  const { score, grade } = legend(b.ach, kbo, mlb, int(b.fame, 0, 60)); // 점수·등급은 서버가 계산
  const c=b.cust&&typeof b.cust==='object'?b.cust:{};
  const cust={skin:int(c.skin,0,5),hcol:int(c.hcol,0,1),style:int(c.style,0,7),cap:int(c.cap,0,20),body:int(c.body,0,3),theme:int(c.theme,0,3),num:int(c.num,0,99),nick:str(c.nick,8),hand:str(c.hand,8)};
  return {
    id: crypto.randomBytes(6).toString('hex'),
    name, pos, grade, score, kbo, mlb,
    role: str(b.role, 40),
    playerRole: str(b.playerRole, 4),
    team: str(b.team, 30),
    region: str(b.region, 12),
    ovr: int(b.ovr, 0, 99),
    pot: str(b.pot, 2),
    cust,
    title: str(b.title, 80),
    peak: int(b.peak, 0, 99),
    t: Date.now() // 24시간은 서버 시각 기준
  };
}

/* ----- 등록: 탑10에 들면 넣고 순위를, 못 들면 0을 돌려준다 ----- */
function submit(e) {
  prune();
  const list = board[e.pos];
  if (list.length >= TOP && e.score <= list[list.length - 1].score) return 0;
  list.push(e);
  list.sort((a, b) => b.score - a.score);
  board[e.pos] = list.slice(0, TOP);
  persist();
  return board[e.pos].indexOf(e) + 1;
}

/* ----- 의견 보내기: 허용된 사이트에서 온 의견만 받아 feedback.jsonl에 쌓는다 (IP당 1시간에 8번) ----- */
const FB = { max: 8, win: 3600 * 1000, body: 4 * 1024 };
const fbHits = new Map();
function fbLimited(ip) {
  const now = Date.now(), h = (fbHits.get(ip) || []).filter(t => now - t < FB.win);
  h.push(now); fbHits.set(ip, h);
  return h.length > FB.max;
}
setInterval(() => { const now = Date.now(); for (const [ip, h] of fbHits) if (!h.some(t => now - t < FB.win)) fbHits.delete(ip); }, FB.win).unref();
function feedbackEntry(b, ip) {
  if (!b || typeof b !== 'object') return null;
  const text = str(b.text, 500);
  if (!text) return null;
  const type = ['버그 제보', '개선 제안', '기타'].includes(b.type) ? b.type : '기타';
  return { t: new Date().toISOString(), type, text, lang: str(b.lang, 4), ua: str(b.ua, 160), ip };
}

const hits = new Map();
function limited(ip) {
  const now = Date.now(), h = (hits.get(ip) || []).filter(t => now - t < RATE.win);
  h.push(now); hits.set(ip, h);
  return h.length > RATE.max;
}
setInterval(() => { const now = Date.now(); for (const [ip, h] of hits) if (!h.some(t => now - t < RATE.win)) hits.delete(ip); }, RATE.win).unref();

const allowed = o => ORIGINS.includes('*') || ORIGINS.includes(o);
function send(res, code, obj) {
  const o = res.req.headers.origin;
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ORIGINS.includes('*') ? '*' : allowed(o) ? o : ORIGINS[0],
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  });
  res.end(obj === undefined ? '' : JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0].replace(/\/+$/, '') || '/';
  if (req.method === 'OPTIONS') return send(res, 204);
  if (url === '/health') return send(res, 200, { ok: true });
  if (url === '/toauthors') {
    if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
    if (!allowed(req.headers.origin)) return send(res, 403, { error: 'origin not allowed' });
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
    if (fbLimited(ip)) return send(res, 429, { error: 'too many requests' });
    let body = '', over = false;
    req.on('data', c => {
      if (over) return;
      body += c;
      if (body.length > FB.body) { over = true; res.setHeader('Connection', 'close'); send(res, 413, { error: 'too large' }); res.on('finish', () => req.destroy()); }
    });
    req.on('end', () => {
      if (over) return;
      let e;
      try { e = feedbackEntry(JSON.parse(body), ip); } catch (err) { e = null; }
      if (!e) return send(res, 400, { error: 'invalid feedback' });
      try { fs.appendFileSync(FEEDBACK_FILE, JSON.stringify(e) + '\n'); } catch (err) { return send(res, 500, { error: 'save failed' }); }
      send(res, 200, { ok: true });
    });
    return;
  }
  if (url !== '/hof' && url !== '/') return send(res, 404, { error: 'not found' });
  if (req.method === 'GET') { prune(); return send(res, 200, board); }
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  if (!allowed(req.headers.origin)) return send(res, 403, { error: 'origin not allowed' }); // 다른 사이트·스크립트에서 온 등록 거부

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  if (limited(ip)) return send(res, 429, { error: 'too many requests' });
  let body = '', over = false;
  req.on('data', c => {
    if (over) return;
    body += c;
    if (body.length > MAX_BODY) { over = true; res.setHeader('Connection', 'close'); send(res, 413, { error: 'entry too large' }); res.on('finish', () => req.destroy()); }
  });
  req.on('end', () => {
    if (over) return;
    let e;
    try { e = clean(JSON.parse(body)); } catch (err) { e = null; }
    if (!e) return send(res, 400, { error: 'invalid entry' });
    const rank = submit(e);
    send(res, 200, { rank, board });
  });
});

load();
server.listen(PORT, () => console.log(`오늘의 명전·의견 서버: http://localhost:${PORT} (/hof, /toauthors, /health · 저장 파일 ${FILE}, 허용 사이트 ${ORIGINS.join(', ')})`));
