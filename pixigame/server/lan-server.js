import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from './static-files.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const dataDir = path.join(root, 'data');
const scoreFile = path.join(dataDir, 'leaderboard.json');
const port = Number(process.env.PORT || 4173);

await mkdir(dataDir, { recursive: true });

async function readScores() {
  try {
    const content = await readFile(scoreFile, 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rankScores(scores) {
  return scores.sort((a, b) => {
    const clearDelta = Number(b.victory) - Number(a.victory);
    if (clearDelta) return clearDelta;
    if (a.victory && b.victory) return b.score - a.score || a.time - b.time;
    return b.time - a.time || b.score - a.score;
  });
}

function isChapterScore(entry) {
  return entry.mode === 'chapter-v2' || entry.mode === 'chapter-v3';
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readRequestBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 16384) throw new Error('Payload too large');
  }
  return JSON.parse(body || '{}');
}

async function handleScores(req, res) {
  if (req.method === 'GET') {
    const scores = rankScores((await readScores()).filter(isChapterScore)).slice(0, 12);
    json(res, 200, { scores });
    return;
  }
  if (req.method === 'POST') {
    try {
      const input = await readRequestBody(req);
      const entry = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        mode: input.mode === 'chapter-v3' ? 'chapter-v3' : input.mode === 'chapter-v2' ? 'chapter-v2' : 'legacy',
        name: String(input.name || '飞行员').replace(/[<>]/g, '').trim().slice(0, 12) || '飞行员',
        stageIndex: Math.max(0, Math.min(16, Math.floor(Number(input.stageIndex) || 0))),
        stageName: String(input.stageName || '').slice(0, 24),
        difficulty: ['easy', 'hard', 'hell'].includes(input.difficulty) ? input.difficulty : 'easy',
        stars: Math.max(0, Math.min(3, Math.floor(Number(input.stars) || 0))),
        bossesDefeated: Math.max(0, Math.min(17, Math.floor(Number(input.bossesDefeated) || 0))),
        score: Math.max(0, Math.floor(Number(input.score) || 0)),
        time: Math.max(0, Math.floor(Number(input.time) || 0)),
        victory: Boolean(input.victory),
        createdAt: new Date().toISOString(),
      };
      const scores = [...(await readScores()), entry].slice(-200);
      await writeFile(scoreFile, `${JSON.stringify(scores, null, 2)}\n`, 'utf8');
      const chapterScores = rankScores(scores.filter(isChapterScore)).slice(0, 12);
      json(res, 201, { entry, scores: chapterScores });
    } catch (error) {
      json(res, 400, { error: error.message });
    }
    return;
  }
  json(res, 405, { error: 'Method not allowed' });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url?.startsWith('/api/scores')) await handleScores(req, res);
    else await serveStatic(req, res, distDir);
  } catch (error) {
    if (res.headersSent) res.destroy(error);
    else json(res, 500, { error: error.message });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Thunder Route LAN server: http://0.0.0.0:${port}`);
});
