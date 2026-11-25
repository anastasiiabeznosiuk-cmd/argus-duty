// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { createArgus } from '../../server/app.js';
import { World } from '../../server/sim.js';

let argus;
let base;
let port;

const call = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};

const login = async (officerId) => (await call('/api/login', { method: 'POST', body: { officerId } })).body.token;

beforeAll(async () => {
  argus = createArgus({ world: new World({ seed: 1 }), tickMs: 50 });
  port = await argus.start(0);
  base = `http://localhost:${port}`;
});
afterAll(() => argus.stop());

describe('REST API тестового сервера', () => {
  it('віддає список черговових без автентифікації', async () => {
    const r = await call('/api/officers');
    expect(r.status).toBe(200);
    expect(r.body.officers).toHaveLength(3);
  });

  it('відмовляє у доступі без токена (401)', async () => {
    expect((await call('/api/tracks')).status).toBe(401);
    expect((await call('/api/events', { token: 'bad-token' })).status).toBe(401);
  });

  it('відмовляє невідомому черговому', async () => {
    expect((await call('/api/login', { method: 'POST', body: { officerId: 'x' } })).status).toBe(401);
  });

  it('віддає цілі, зони, джерела й події після входу', async () => {
    const token = await login('o-2');
    expect((await call('/api/tracks', { token })).body.tracks).toHaveLength(37);
    expect((await call('/api/zones', { token })).body.zones).toHaveLength(7);
    expect((await call('/api/sources', { token })).body.sources).toHaveLength(5);
    const ev = await call('/api/events?priority=critical', { token });
    expect(ev.body.events.length).toBeGreaterThan(0);
    expect(ev.body.events.every((e) => e.priority === 'critical')).toBe(true);
  });

  it('повертає 404 для невідомої цілі', async () => {
    const token = await login('o-2');
    expect((await call('/api/tracks/T-9999', { token })).status).toBe(404);
  });

  it('обмежує історію треку 60 положеннями', async () => {
    const token = await login('o-2');
    await new Promise((r) => setTimeout(r, 400));
    const r = await call('/api/tracks/T-0001', { token });
    expect(r.body.history.length).toBeLessThanOrEqual(60);
  });

  it('критична подія без коментаря — 422, з коментарем — 200', async () => {
    const token = await login('o-2');
    const crit = (await call('/api/events?priority=critical&status=new', { token })).body.events[0];
    const bad = await call(`/api/events/${crit.id}/ack`, { method: 'POST', body: { comment: '' }, token });
    expect(bad.status).toBe(422);
    const ok = await call(`/api/events/${crit.id}/ack`, { method: 'POST', body: { comment: 'Взято в роботу' }, token });
    expect(ok.status).toBe(200);
    expect(ok.body.event.status).toBe('acked');
    expect(ok.body.event.ackBy).toBe('Мельник Т. В.');
  });

  it('закриту подію змінити не можна — 409', async () => {
    const token = await login('o-2');
    const closed = (await call('/api/events?status=closed', { token })).body.events[0];
    const r = await call(`/api/events/${closed.id}/ack`, { method: 'POST', body: { comment: 'x' }, token });
    expect(r.status).toBe(409);
  });

  it('режим збою повертає 503, а потім відновлюється', async () => {
    const token = await login('o-2');
    await call('/api/_chaos', { method: 'POST', body: { mode: 'error' } });
    expect((await call('/api/events', { token })).status).toBe(503);
    await call('/api/_chaos', { method: 'POST', body: { mode: 'off' } });
    expect((await call('/api/events', { token })).status).toBe(200);
  });
});

describe('Зміна через API', () => {
  it('приймання вимагає перегляду подій, потім передавання створює новий звіт', async () => {
    const token = await login('o-2');
    const shift = (await call('/api/shift', { token })).body;
    expect(shift.pendingHandover).toBeTruthy();
    const reportId = shift.pendingHandover.id;

    const early = await call('/api/shift/accept', { method: 'POST', body: { reportId, reviewedEventIds: [] }, token });
    expect(early.status).toBe(422);
    expect(early.body.error).toBe('not_reviewed');

    const accepted = await call('/api/shift/accept', {
      method: 'POST',
      body: { reportId, reviewedEventIds: shift.pendingHandover.openEventIds },
      token,
    });
    expect(accepted.status).toBe(200);

    const other = await login('o-3');
    expect((await call('/api/shift/handover', { method: 'POST', body: { notes: '' }, token: other })).status).toBe(403);

    const handed = await call('/api/shift/handover', { method: 'POST', body: { notes: 'Усе спокійно' }, token });
    expect(handed.status).toBe(200);
    expect(handed.body.report.notes).toBe('Усе спокійно');
  });
});

describe('WebSocket-потік', () => {
  const open = (token) =>
    new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
      const messages = [];
      ws.on('message', (m) => messages.push(JSON.parse(m)));
      ws.on('open', () => resolve({ ws, messages }));
      ws.on('error', reject);
    });

  it('не пускає без токена', async () => {
    await expect(open('bad-token')).rejects.toThrow();
  });

  it('надсилає hello і пакети оновлень цілей', async () => {
    const token = await login('o-2');
    const { ws, messages } = await open(token);
    await new Promise((r) => setTimeout(r, 300));
    ws.close();
    expect(messages[0].type).toBe('hello');
    const batch = messages.find((m) => m.type === 'track.batch');
    expect(batch.tracks.length).toBeGreaterThan(0);
    expect(batch.tracks[0]).not.toHaveProperty('route');
  });

  it('розсилає зміну статусу події всім підписникам', async () => {
    const token = await login('o-2');
    const { ws, messages } = await open(token);
    const ev = (await call('/api/events?status=new&priority=medium', { token })).body.events[0];
    await call(`/api/events/${ev.id}/close`, { method: 'POST', body: { comment: 'Перевірено' }, token });
    await new Promise((r) => setTimeout(r, 100));
    ws.close();
    const upd = messages.find((m) => m.type === 'event.update' && m.event.id === ev.id);
    expect(upd.event.status).toBe('closed');
  });
});
