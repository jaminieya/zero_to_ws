#!/usr/bin/env node
/* 오늘의 명전 서버 — 외부 패키지 없이 Node.js 기본 모듈만 사용
   GET  /hof  → {포지션: [기록 ...]}  (포지션별 레전드 점수 탑10, 24시간 안의 기록만)
   POST /hof  → 기록 1개 등록. 그 포지션 탑10에 들 때만 저장하고, 결과와 최신 목록을 돌려준다
   설정(환경 변수): PORT(기본 8787) · HOF_FILE(기본 이 폴더의 hof-data.json) · ALLOW_ORIGIN(기본 *) */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = +process.env.PORT || 8787;
const FILE = process.env.HOF_FILE || path.join(__dirname, 'hof-data.json');
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
const TTL = 24 * 3600 * 1000;
const TOP = 10;
const POS = ['C', 'CI', 'MI', 'OF', 'DH', 'SP', 'MR', 'CL'];
const GRADES = ['S', 'A', 'B', 'C', 'D', 'E'];
const MAX_BODY = 4 * 1024;
const RATE = { max: 10, win: 60 * 1000 }; // IP당 1분에 등록 10번까지

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
  const pos = str(b.pos, 4), grade = str(b.grade, 1), name = str(b.name, 20);
  if (!POS.includes(pos) || !GRADES.includes(grade) || !name) return null;
  return {
    id: crypto.randomBytes(6).toString('hex'),
    name, pos, grade,
    role: str(b.role, 40),
    title: str(b.title, 80),
    score: int(b.score, 0, 999),
    peak: int(b.peak, 0, 99),
    kbo: int(b.kbo, 0, 40),
    mlb: int(b.mlb, 0, 40),
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

const hits = new Map();
function limited(ip) {
  const now = Date.now(), h = (hits.get(ip) || []).filter(t => now - t < RATE.win);
  h.push(now); hits.set(ip, h);
  return h.length > RATE.max;
}
setInterval(() => { const now = Date.now(); for (const [ip, h] of hits) if (!h.some(t => now - t < RATE.win)) hits.delete(ip); }, RATE.win).unref();

function send(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  });
  res.end(obj === undefined ? '' : JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0].replace(/\/+$/, '') || '/';
  if (req.method === 'OPTIONS') return send(res, 204);
  if (url !== '/hof' && url !== '/') return send(res, 404, { error: 'not found' });
  if (req.method === 'GET') { prune(); return send(res, 200, board); }
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });

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
server.listen(PORT, () => console.log(`오늘의 명전 서버: http://localhost:${PORT}/hof (저장 파일 ${FILE})`));
