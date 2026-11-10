#!/usr/bin/env node
/* 오늘의 명전 서버 — 외부 패키지 없이 Node.js 기본 모듈만 사용
   POST /toauthors → 의견 보내기(게임 허브의 확성기). 받은 의견을 이 폴더의 feedback.jsonl에 한 줄씩 쌓는다
   POST /visit    → 방문 1번 기록. 날짜(한국 시각)별 페이지뷰·순방문자·첫 방문자를 visits.json에 쌓는다
                    {ev:'start'}·{ev:'end'}는 방문 대신 새 게임 시작·은퇴(게임 완료) 수만 센다
                    보기: node server/hof-server.js visits [일수]  (npm run visits)
   GET  /health   → {ok:true}
   POST /auth     → {credential: 구글 ID 토큰} 을 구글 공개키로 검증하고 세션 토큰을 발급한다 (30일)
   POST /logout   → 세션 토큰을 지운다
   GET  /team     → 로그인한 사람의 '내 팀' 기록 (은퇴 뒤 7일 동안만 남는다)
   GET  /team-rank → 계정별 현재 로스터의 선수 OVR 평균 탑10
   POST /team     → 은퇴한 선수 기록 1개를 내 팀에 넣는다 (포지션 정원을 넘으면 점수 높은 선수만 남는다) · DELETE /team?id=... → 뺀다
                    /team·/logout 은 Authorization: Bearer <세션 토큰> 이 필요하다
   GET  /hof  → {포지션: [기록 ...]}  (포지션별 레전드 점수 탑10, 24시간 안의 기록만)
   POST /hof  → 기록 1개 등록. 그 포지션 탑10에 들 때만 저장하고, 결과와 최신 목록을 돌려준다
   위조 방지: 허용된 사이트(Origin)에서 온 등록만 받고, 레전드 점수·등급은 클라이언트 값을 믿지 않고
   보내온 수상·기록 목록으로 서버가 다시 계산한다(규칙은 게임 코드 index.html에서 그대로 읽는다)
   설정(환경 변수): PORT(기본 3000, Cloudflare Tunnel이 가리키는 포트) · HOF_FILE(기본 이 폴더의 hof-data.json)
                   ALLOW_ORIGIN(기본 www.zerotows.com·zerotows.com·jaminieya.github.io, 쉼표로 여러 개, * 는 모두 허용)
                   GAME_HTML(기본 ../index.html) · TEAM_FILE(기본 이 폴더의 team-data.json)
                   GOOGLE_CLIENT_ID(기본 index.html의 GOOGLE_CLIENT_ID) */
'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const PORT = +process.env.PORT || 3000;
const FEEDBACK_FILE = process.env.FEEDBACK_FILE || path.join(__dirname, 'feedback.jsonl');
const VISITS_FILE = process.env.VISITS_FILE || path.join(__dirname, 'visits.json');
const FILE = process.env.HOF_FILE || path.join(__dirname, 'hof-data.json');
const ORIGINS = (process.env.ALLOW_ORIGIN || 'https://www.zerotows.com,https://zerotows.com,https://jaminieya.github.io').split(',').map(s => s.trim()).filter(Boolean);
const GAME_HTML = process.env.GAME_HTML || path.join(__dirname, '..', 'index.html');
const TTL = 24 * 3600 * 1000;
const TOP = 10;
const POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'SP', 'MR', 'CL'];
/* 예전 수비 위치를 지금 규칙으로 바꾼다 (게임의 legacySlot과 같다). 좌투는 1루수·외야만 */
const legacyPos = (p, hand) => { const L = String(hand || '').charAt(0) === '좌'; return p === 'CI' || p === 'IF' ? (L ? '1B' : '3B') : p === 'MI' ? (L ? 'CF' : '2B') : p === 'OF' ? (L ? 'RF' : 'LF') : L && p === 'SS' ? 'CF' : L && p === 'C' ? '1B' : p; };
const MAX_BODY = 4 * 1024;
const RATE = { max: 10, win: 60 * 1000 }; // IP당 1분에 등록 10번까지
const TEAM_FILE = process.env.TEAM_FILE || path.join(__dirname, 'team-data.json');
const TEAM_TTL = 7 * 24 * 3600 * 1000;      // 내 팀 기록은 은퇴(등록) 뒤 7일
/* 내 팀 자리: 포지션마다 정원이 있고, 넘치면 점수가 높은 선수만 남는다(같으면 OVR이 높은 쪽, 그것도 같으면 먼저 있던 선수) */
const TEAM_SLOTS = { SP: 5, MR: 2, CL: 2, C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, LF: 1, CF: 1, RF: 1, DH: 1 };
const teamOvr = e => e.peak || e.ovr || 0;
function fitRoster(list) {
  const out = [];
  list.forEach(e => { e.pos = legacyPos(e.pos, e.cust && e.cust.hand); });
  for (const [pos, n] of Object.entries(TEAM_SLOTS)) out.push(...list.filter(e => e.pos === pos).sort((a, b) => b.score - a.score || teamOvr(b) - teamOvr(a)).slice(0, n));
  return out;
}
const SESSION_TTL = 30 * 24 * 3600 * 1000;  // 로그인 유지 30일

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
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || (() => {
  try { return vm.runInNewContext(grab(fs.readFileSync(GAME_HTML, 'utf8'), 'const GOOGLE_CLIENT_ID=') + ';GOOGLE_CLIENT_ID', {}); } catch (e) { return ''; }
})();
const RULES = (() => {
  const src = fs.readFileSync(GAME_HTML, 'utf8');
  const code = ['const PTS=', 'const TEAM_AWARD=', 'const FEAT_KEYS=', 'const achCat=', 'const LEGEND=', 'const DIFF_SCORE=', 'function gradeOf('].map(h => grab(src, h)).join('\n');
  return vm.runInNewContext(code + '\n;({PTS,TEAM_AWARD,FEAT_KEYS,achCat,LEGEND,DIFF_SCORE,gradeOf})', {});
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
function legend(ach, kbo, mlb, fame, diff) {
  const { PTS, achCat, LEGEND, DIFF_SCORE, gradeOf } = RULES, raw = { team: 0, personal: 0, feat: 0 };
  for (const [k, v] of Object.entries(ach && typeof ach === 'object' ? ach : {})) {
    if (!(k in PTS)) continue;
    const cap = capFor(k, kbo, mlb);
    raw[achCat(k)] += PTS[k] * int(v, 0, cap);
  }
  let score = Math.round(Math.min(99, kbo * 2.5 + mlb * 4.5 + Math.min(fame, 20) * 1.5));
  for (const c in LEGEND) score += Math.round(LEGEND[c].cap * (1 - Math.exp(-raw[c] / LEGEND[c].k)));
  score = Math.min(999, Math.round(score * (DIFF_SCORE[diff] || 1))); // 난이도 배율 (쉬움 0.8 · 보통 1 · 어려움 1.2)
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
/* 명전에 올릴 수 없는 이름: 공백·기호·영문을 빼고 이 낱말이 들어 있으면 막는다 */
const BLOCKED_NAMES = ['노무현', '로무흔'];
const blockedName = n => { const s = String(n || '').replace(/[^가-힣]/g, ''); return BLOCKED_NAMES.some(w => s.includes(w)); };
/* 24시간 지난 기록과 막힌 이름을 빼고, 포지션마다 점수순 탑10만 남긴다 */
function prune() {
  const now = Date.now();
  /* 예전 위치 이름이나 지금 규칙에 맞지 않는 위치의 기록은 새 위치로 옮긴다 */
  const all = []; for (const k of Object.keys(board)) for (const e of Array.isArray(board[k]) ? board[k] : []) { e.pos = legacyPos(e.pos || k, e.cust && e.cust.hand); all.push(e); }
  board = {}; for (const e of all) (board[e.pos] = board[e.pos] || []).push(e);
  for (const p of POS) {
    board[p] = (board[p] || []).filter(e => now - e.t < TTL && !blockedName(e.name)).sort((a, b) => b.score - a.score).slice(0, TOP);
  }
  for (const k of Object.keys(board)) if (!POS.includes(k)) delete board[k];
}

/* ----- 입력 검사: 클라이언트 값은 믿지 않고 필요한 필드만 범위 안으로 받는다 ----- */
const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n) : '');
const int = (v, lo, hi) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : lo);
function clean(b) {
  if (!b || typeof b !== 'object') return null;
  const pos = legacyPos(str(b.pos, 4), b.cust && b.cust.hand), name = str(b.name, 20);
  if (!POS.includes(pos) || !name || blockedName(name)) return null;
  const kbo = int(b.kbo, 0, 30), mlb = int(b.mlb, 0, 30);
  if (kbo + mlb > 30) return null;
  const { score, grade } = legend(b.ach, kbo, mlb, int(b.fame, 0, 60), [0, 1, 2].includes(b.diff) ? b.diff : 1); // 점수·등급은 서버가 계산
  const c=b.cust&&typeof b.cust==='object'?b.cust:{};
  const cust={skin:int(c.skin,0,5),hcol:int(c.hcol,0,1),style:int(c.style,0,7),cap:int(c.cap,0,20),body:int(c.body,0,3),theme:int(c.theme,0,3),num:int(c.num,0,99),nick:str(c.nick,8),hand:str(c.hand,8)};
  return {
    id: crypto.randomBytes(6).toString('hex'),
    name, pos, grade, score, kbo, mlb,
    diff: [0, 1, 2].includes(b.diff) ? b.diff : undefined, // 난이도 0 쉬움 · 1 보통 · 2 어려움
    role: str(b.role, 40),
    playerRole: str(b.playerRole, 4),
    team: str(b.team, 30),
    region: str(b.region, 12),
    ovr: int(b.ovr, 0, 99),
    pot: str(b.pot, 2),
    cust,
    title: str(b.title, 80),
    peak: int(b.peak, 0, 99),
    st: Array.isArray(b.st) ? b.st.slice(0, 6).map(v => int(v, 0, 99)) : [],
    labels: Array.isArray(b.labels) ? b.labels.slice(0, 6).map(v => str(v, 8)) : [],
    aw: Array.isArray(b.aw) ? b.aw.slice(0, 14).map(v => str(v, 40)).filter(Boolean) : [],
    carK: str(b.carK, 160),
    carM: str(b.carM, 160),
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

/* ----- 구글 로그인: ID 토큰을 구글 공개키(JWKS)로 직접 검증한다. 공개키는 응답의 max-age 동안 캐시 ----- */
let jwks = { keys: [], exp: 0 };
function googleKeys() {
  if (Date.now() < jwks.exp) return Promise.resolve(jwks.keys);
  return new Promise((ok, no) => {
    https.get('https://www.googleapis.com/oauth2/v3/certs', r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => {
        try {
          const age = +(/max-age=(\d+)/.exec(r.headers['cache-control'] || '') || [])[1] || 3600;
          jwks = { keys: JSON.parse(d).keys || [], exp: Date.now() + age * 1000 }; ok(jwks.keys);
        } catch (e) { no(e); }
      });
    }).on('error', no);
  });
}
const b64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
async function verifyGoogle(tok) {
  if (!GOOGLE_CLIENT_ID || typeof tok !== 'string' || tok.length > 4096) return null;
  const [h, p, sig] = tok.split('.');
  if (!h || !p || !sig) return null;
  let head, body;
  try { head = JSON.parse(b64u(h)); body = JSON.parse(b64u(p)); } catch (e) { return null; }
  if (head.alg !== 'RS256') return null;
  const jwk = (await googleKeys()).find(k => k.kid === head.kid);
  if (!jwk) return null;
  const okSig = crypto.verify('RSA-SHA256', Buffer.from(h + '.' + p), crypto.createPublicKey({ key: jwk, format: 'jwk' }), b64u(sig));
  if (!okSig || body.aud !== GOOGLE_CLIENT_ID || !['accounts.google.com', 'https://accounts.google.com'].includes(body.iss) || body.exp * 1000 < Date.now() || !body.sub) return null;
  return { sub: String(body.sub), name: str(body.name || '', 40), email: str(body.email || '', 80) };
}

/* ----- 내 팀: 세션(토큰 → 구글 계정)과 계정별 선수 목록. 7일 지난 기록·만료된 세션은 읽을 때마다 정리 ----- */
let team = { sessions: {}, teams: {} };
try { team = Object.assign(team, JSON.parse(fs.readFileSync(TEAM_FILE, 'utf8'))); } catch (e) {}
function teamPrune() {
  const now = Date.now();
  for (const [k, v] of Object.entries(team.sessions)) if (v.exp < now) delete team.sessions[k];
  for (const [sub, l] of Object.entries(team.teams)) { const keep = fitRoster(l.filter(e => now - e.t < TEAM_TTL)); /* 7일 지난 기록을 빼고, 예전 위치 이름·정원도 맞춘다 */ if (keep.length) team.teams[sub] = keep; else delete team.teams[sub]; }
}
/* 팀 OVR은 현재 로스터에 등록된 각 포지션 선수 OVR의 산술평균이다. */
function teamRanking() {
  teamPrune();
  return Object.entries(team.teams).map(([sub, list]) => {
    const roster = fitRoster(list), sum = roster.reduce((n, e) => n + teamOvr(e), 0);
    const owner = team.owners && team.owners[sub] || Object.values(team.sessions).find(s => s.sub === sub);
    return { name: str(owner && owner.name, 20) || '익명 감독', ovr: roster.length ? Math.round(sum / roster.length * 10) / 10 : 0, players: roster.length };
  }).filter(e => e.players).sort((a, b) => b.ovr - a.ovr || b.players - a.players || a.name.localeCompare(b.name)).slice(0, TOP);
}
function teamSave() {
  const tmp = TEAM_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(team));
  fs.renameSync(tmp, TEAM_FILE);
}
function session(req) {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.authorization || '');
  const s = m && team.sessions[m[1]];
  return s && s.exp > Date.now() ? Object.assign({ token: m[1] }, s) : null;
}
const tHits = new Map();
function tLimited(ip) {
  const now = Date.now(), h = (tHits.get(ip) || []).filter(t => now - t < RATE.win);
  h.push(now); tHits.set(ip, h);
  return h.length > 30;
}
setInterval(() => { const now = Date.now(); for (const [ip, h] of tHits) if (!h.some(t => now - t < RATE.win)) tHits.delete(ip); }, RATE.win).unref();
function readJson(req, res, max, cb) {
  let body = '', over = false;
  req.on('data', c => {
    if (over) return;
    body += c;
    if (body.length > max) { over = true; res.setHeader('Connection', 'close'); send(res, 413, { error: 'too large' }); res.on('finish', () => req.destroy()); }
  });
  req.on('end', () => { if (over) return; let b = null; try { b = JSON.parse(body); } catch (e) {} cb(b); });
}
function teamRoute(req, res, url) {
  if (!allowed(req.headers.origin)) return send(res, 403, { error: 'origin not allowed' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  if (tLimited(ip)) return send(res, 429, { error: 'too many requests' });
  teamPrune();
  if (url === '/team-rank') {
    if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' });
    return send(res, 200, { list: teamRanking() });
  }
  if (url === '/auth') {
    if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
    return readJson(req, res, 8 * 1024, b => {
      verifyGoogle(b && b.credential).then(u => {
        if (!u) return send(res, 401, { error: 'invalid credential' });
        const token = crypto.randomBytes(32).toString('hex');
        team.sessions[token] = { sub: u.sub, name: u.name, email: u.email, exp: Date.now() + SESSION_TTL };
        teamSave();
        send(res, 200, { token, name: u.name, email: u.email });
      }, () => send(res, 502, { error: 'google keys unavailable' }));
    });
  }
  const s = session(req);
  if (!s) return send(res, 401, { error: 'login required' });
  if (url === '/logout') { delete team.sessions[s.token]; teamSave(); return send(res, 200, { ok: true }); }
  const mine = () => (team.teams[s.sub] || []).slice().sort((a, b) => b.t - a.t);
  if (req.method === 'GET') return send(res, 200, { list: mine() });
  if (req.method === 'DELETE') {
    const id = new URL(req.url, 'http://x').searchParams.get('id');
    team.teams[s.sub] = (team.teams[s.sub] || []).filter(e => e.id !== id);
    teamSave(); return send(res, 200, { list: mine() });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  readJson(req, res, 8 * 1024, b => {
    const e = clean(b); // 명전과 같은 검사·점수 계산
    if (!e) return send(res, 400, { error: 'invalid entry' });
    const l = team.teams[s.sub] || [], kept = fitRoster(l.concat(e));
    const added = kept.includes(e), bumped = l.filter(x => !kept.includes(x)).map(x => x.name);
    team.teams[s.sub] = kept;
    team.owners = team.owners || {}; team.owners[s.sub] = { name: str(s.name, 20) };
    teamSave();
    send(res, 200, { list: mine(), added, bumped });
  });
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

/* ----- 방문자 수: IP는 저장하지 않는다. 날마다 바뀌는 무작위 소금으로 IP+브라우저를 해시해 그날 순방문자만 센다 ----- */
const kstDay = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
let visits = { days: {}, today: '', salt: '', seen: [], users: {} };
try { visits = Object.assign(visits, JSON.parse(fs.readFileSync(VISITS_FILE, 'utf8'))); } catch (e) {}
visits.users = visits.users || {};
let seen = new Set(visits.seen), vDirty = false;
function dayRec() {
  const day = kstDay();
  if (visits.today !== day) { visits.today = day; visits.salt = crypto.randomBytes(16).toString('hex'); seen = new Set(); }
  const d = visits.days[day] || (visits.days[day] = { views: 0, uniq: 0, first: 0 });
  d.sessions = d.sessions || 0;
  d.returning = d.returning || 0;
  d.playSec = d.playSec || 0;
  return d;
}
function userKey(uid) {
  if (typeof uid !== 'string' || uid.length < 16 || uid.length > 100) return '';
  return crypto.createHash('sha256').update(uid).digest('hex').slice(0, 32);
}
function userSession(uid) {
  const key = userKey(uid);
  if (!key) return;
  const d = dayRec(), u = visits.users[key] || { sessions: 0, playSec: 0 };
  if (u.sessions > 0) d.returning++;
  d.sessions++;
  u.sessions++;
  visits.users[key] = u;
  vDirty = true;
}
function userLeave(uid, seconds) {
  const key = userKey(uid), sec = Math.max(0, Math.min(86400, Number(seconds) || 0));
  if (!key || !sec || !visits.users[key]) return;
  const d = dayRec(), u = visits.users[key];
  u.playSec = (u.playSec || 0) + sec;
  d.playSec += sec;
  vDirty = true;
}
function gameEvent(ev) {
  const d = dayRec(), k = ev === 'start' ? 'starts' : 'ends';
  d[k] = (d[k] || 0) + 1;
  vDirty = true;
}
function visit(ip, ua, first) {
  const d = dayRec();
  const h = crypto.createHash('sha256').update(visits.salt + ip + '|' + ua).digest('hex').slice(0, 16);
  d.views++;
  if (!seen.has(h)) { seen.add(h); d.uniq++; }
  if (first) d.first++;
  vDirty = true;
}
function saveVisits() {
  if (!vDirty) return;
  vDirty = false; visits.seen = [...seen];
  const tmp = VISITS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(visits));
  fs.renameSync(tmp, VISITS_FILE);
}
setInterval(saveVisits, 60 * 1000).unref();
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { saveVisits(); process.exit(0); });
const vHits = new Map();
function vLimited(ip) {
  const now = Date.now(), h = (vHits.get(ip) || []).filter(t => now - t < RATE.win);
  h.push(now); vHits.set(ip, h);
  return h.length > 30;
}
setInterval(() => { const now = Date.now(); for (const [ip, h] of vHits) if (!h.some(t => now - t < RATE.win)) vHits.delete(ip); }, RATE.win).unref();

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
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store'
  });
  res.end(obj === undefined ? '' : JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0].replace(/\/+$/, '') || '/';
  if (req.method === 'OPTIONS') return send(res, 204);
  if (url === '/health') return send(res, 200, { ok: true });
  if (url === '/auth' || url === '/logout' || url === '/team' || url === '/team-rank') return teamRoute(req, res, url);
  if (url === '/visit') {
    if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
    if (!allowed(req.headers.origin)) return send(res, 403, { error: 'origin not allowed' });
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
    if (vLimited(ip)) return send(res, 429, { error: 'too many requests' });
    let body = '';
    req.on('data', c => { if (body.length < 256) body += c; });
    req.on('end', () => {
      let b = {};
      try { b = JSON.parse(body) || {}; } catch (e) {}
      if (b.ev === 'session') userSession(b.uid);
      else if (b.ev === 'leave') userLeave(b.uid, b.seconds);
      else if (b.ev === 'start' || b.ev === 'end') gameEvent(b.ev);
      else visit(ip, str(req.headers['user-agent'], 200), b.first === 1);
      send(res, 200, { ok: true });
    });
    return;
  }
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

/* node server/hof-server.js visits [일수] → 최근 방문 통계를 표로 보여 주고 끝낸다 */
if (process.argv[2] === 'visits') {
  const n = +process.argv[3] || 14, days = Object.keys(visits.days).sort().slice(-n);
  console.log('날짜        페이지뷰  순방문자  재방문  세션  평균플레이  게임 시작  은퇴 완료');
  for (const k of days) { const d = visits.days[k], avg = d.uniq ? (d.playSec || 0) / d.uniq / 60 : 0; console.log(`${k}  ${String(d.views).padStart(8)}  ${String(d.uniq).padStart(8)}  ${String(d.returning || 0).padStart(6)}  ${String(d.sessions || 0).padStart(4)}  ${(avg.toFixed(1) + '분').padStart(10)}  ${String(d.starts || 0).padStart(9)}  ${String(d.ends || 0).padStart(9)}`); }
  const all = Object.values(visits.days).reduce((a, d) => ({ views: a.views + d.views, first: a.first + d.first, returning: a.returning + (d.returning || 0), sessions: a.sessions + (d.sessions || 0), playSec: a.playSec + (d.playSec || 0), starts: a.starts + (d.starts || 0), ends: a.ends + (d.ends || 0) }), { views: 0, first: 0, returning: 0, sessions: 0, playSec: 0, starts: 0, ends: 0 });
  const users = Object.values(visits.users), returningUsers = users.filter(u => u.sessions > 1).length, avgUser = users.length ? all.playSec / users.length / 60 : 0;
  console.log(`전체 페이지뷰 ${all.views} · 기록상 첫 방문 합계 ${all.first} · 전체 사용자 ${users.length}명 · 재접속 사용자 ${returningUsers}명 (${users.length ? (returningUsers / users.length * 100).toFixed(1) : '0.0'}%)`);
  console.log(`사용자당 평균 플레이 ${avgUser.toFixed(1)}분 · 세션 ${all.sessions} · 게임 시작 ${all.starts} · 은퇴 완료 ${all.ends} · 기록 ${Object.keys(visits.days).length}일`);
  console.log('(게임 시작·은퇴 완료는 2026-11-02 배포 이후부터 센다)');
  process.exit(0);
}
load();
server.listen(PORT, () => console.log(`오늘의 명전·의견 서버: http://localhost:${PORT} (/hof, /team-rank, /toauthors, /visit, /team, /health · 저장 파일 ${FILE}, ${TEAM_FILE}, 허용 사이트 ${ORIGINS.join(', ')})`));
