// HTTP (REST) і WebSocket шар тестового сервера ARGUS.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { WebSocketServer } from 'ws';
import { World } from './sim.js';
import { CLASSIFICATION_LABEL, PRIORITY_LABEL, SLA_MINUTES } from './seed.js';

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve(null);
      }
    });
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

// Роздача зібраного вебінтерфейсу (dist/) у розгорнутому режимі: один сервер віддає і сайт, і API.
// Невідомі шляхи (/picture, /shift…) повертають index.html — маршрути обробляє React Router.
async function serveStatic(res, root, pathname) {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  let file = join(root, rel);
  if (file !== root && !file.startsWith(root + sep)) return false;
  let body;
  try {
    body = await readFile(file);
  } catch {
    file = join(root, 'index.html');
    try {
      body = await readFile(file);
    } catch {
      return false;
    }
  }
  const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const cache = file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache });
  res.end(body);
  return true;
}

export function createArgus({ world = new World(), tickMs = 2000, staticDir = null } = {}) {
  const tokens = new Map(); // token → officer
  const chaos = { mode: 'off' }; // 'off' | 'error' | 'slow' — для перевірки станів помилки і завантаження
  const sockets = new Set();

  const officerOf = (req, url) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : url.searchParams.get('token');
    return tokens.get(token) ?? null;
  };

  const handler = async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    const method = req.method;
    try {
      if (method === 'OPTIONS') return json(res, 204, {});

      if (path === '/api/health') return json(res, 200, { ok: true, time: new Date(world.now()).toISOString(), speed: world.speed });
      if (path === '/api/meta') {
        return json(res, 200, { sla: SLA_MINUTES, priorities: PRIORITY_LABEL, classifications: CLASSIFICATION_LABEL });
      }
      if (path === '/api/officers' && method === 'GET') return json(res, 200, { officers: world.officers });

      if (path === '/api/_chaos' && method === 'POST') {
        const body = await readBody(req);
        chaos.mode = ['error', 'slow'].includes(body?.mode) ? body.mode : 'off';
        return json(res, 200, chaos);
      }

      if (path === '/api/login' && method === 'POST') {
        const body = await readBody(req);
        const officer = world.officers.find((o) => o.id === body?.officerId);
        if (!officer) return json(res, 401, { error: 'unknown_officer', message: 'Невідомий черговий' });
        const token = randomBytes(16).toString('hex');
        tokens.set(token, officer);
        world.startShiftIfFree(officer);
        return json(res, 200, { token, officer });
      }

      if (!path.startsWith('/api/')) {
        if (staticDir && method === 'GET' && (await serveStatic(res, staticDir, path))) return;
        return json(res, 404, { error: 'not_found' });
      }
      const officer = officerOf(req, url);
      if (!officer) return json(res, 401, { error: 'unauthorized', message: 'Потрібен вхід' });

      if (chaos.mode === 'slow') await sleep(2500);
      if (chaos.mode === 'error' && method === 'GET') {
        return json(res, 503, { error: 'unavailable', message: 'Тестовий збій сервера' });
      }

      if (path === '/api/me') return json(res, 200, { officer });
      if (path === '/api/tracks' && method === 'GET') {
        return json(res, 200, { tracks: world.listTracks(), serverTime: new Date(world.now()).toISOString() });
      }
      const trackMatch = path.match(/^\/api\/tracks\/([\w-]+)$/);
      if (trackMatch && method === 'GET') {
        const t = world.tracks.get(trackMatch[1]);
        if (!t) return json(res, 404, { error: 'not_found' });
        return json(res, 200, { track: world.publicTrack(t), history: t.history });
      }
      if (path === '/api/events' && method === 'GET') {
        const q = Object.fromEntries(url.searchParams);
        return json(res, 200, { events: world.listEvents(q), counts: world.counts() });
      }
      const evMatch = path.match(/^\/api\/events\/([\w-]+)\/(ack|close)$/);
      if (evMatch && method === 'POST') {
        const body = await readBody(req);
        if (!body) return json(res, 400, { error: 'bad_json' });
        const out = world.resolveEvent(evMatch[1], evMatch[2] === 'ack' ? 'acked' : 'closed', officer, body.comment ?? '');
        if (out.error === 'not_found') return json(res, 404, out);
        if (out.error === 'comment_required') {
          return json(res, 422, { ...out, message: 'Для критичної події потрібен коментар' });
        }
        if (out.error) return json(res, 409, out);
        return json(res, 200, out);
      }
      if (path === '/api/zones' && method === 'GET') return json(res, 200, { zones: world.zones });
      if (path === '/api/sources' && method === 'GET') return json(res, 200, { sources: world.listSources() });
      if (path === '/api/shift' && method === 'GET') return json(res, 200, { ...world.getShift(), me: officer });
      if (path === '/api/shift/handover' && method === 'POST') {
        const body = await readBody(req);
        const out = world.handover(officer, body?.notes ?? '');
        return out.error ? json(res, 403, out) : json(res, 200, out);
      }
      if (path === '/api/shift/accept' && method === 'POST') {
        const body = await readBody(req);
        const out = world.accept(officer, body?.reportId, body?.reviewedEventIds ?? []);
        if (out.error === 'not_reviewed') return json(res, 422, { ...out, message: 'Не переглянуто всі незакриті події' });
        return out.error ? json(res, 409, out) : json(res, 200, out);
      }
      return json(res, 404, { error: 'not_found' });
    } catch (err) {
      return json(res, 500, { error: 'internal', message: String(err?.message ?? err) });
    }
  };

  const server = createServer(handler);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/ws' || !officerOf(req, url)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      sockets.add(ws);
      ws.on('close', () => sockets.delete(ws));
      ws.send(JSON.stringify({ type: 'hello', serverTime: new Date(world.now()).toISOString() }));
    });
  });

  const unsubscribe = world.on((msg) => {
    const text = JSON.stringify(msg);
    for (const ws of sockets) if (ws.readyState === 1) ws.send(text);
  });

  let timer = null;
  return {
    world,
    server,
    start(port = 4000) {
      timer = setInterval(() => world.tick(tickMs / 1000), tickMs);
      return new Promise((resolve) => server.listen(port, () => resolve(server.address().port)));
    },
    stop() {
      clearInterval(timer);
      unsubscribe();
      for (const ws of sockets) ws.terminate();
      wss.close();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}
