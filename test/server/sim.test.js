// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { World } from '../../server/sim.js';
import { pointInRing, distanceNm } from '../../server/geo.js';
import { ZONES } from '../../server/seed.js';

const fixed = (t0 = 1_800_000_000_000) => {
  const clock = { t: t0 };
  return { clock, now: () => clock.t };
};

describe('геометрія', () => {
  it('визначає належність точки полігону', () => {
    const ring = ZONES.find((z) => z.id === 'z-4').rings[0];
    expect(pointInRing({ lon: 31.08, lat: 46.44 }, ring)).toBe(true);
    expect(pointInRing({ lon: 30.5, lat: 46.1 }, ring)).toBe(false);
  });
  it('1 градус широти ≈ 60 морських миль', () => {
    expect(distanceNm({ lat: 46, lon: 30 }, { lat: 47, lon: 30 })).toBeCloseTo(60, 0);
  });
});

describe('World: обстановка', () => {
  it('створює 27 надводних і 10 повітряних цілей', () => {
    const w = new World({ seed: 1 });
    const tracks = w.listTracks();
    expect(tracks.filter((t) => t.domain === 'surface')).toHaveLength(27);
    expect(tracks.filter((t) => t.domain === 'air')).toHaveLength(10);
  });

  it('однакове зерно дає однакову обстановку', () => {
    const a = new World({ seed: 3 }).listTracks().map((t) => [t.name, t.lat.toFixed(4)]);
    const b = new World({ seed: 3 }).listTracks().map((t) => [t.name, t.lat.toFixed(4)]);
    expect(a).toEqual(b);
  });

  it('зберігає не більше 60 положень треку', () => {
    const w = new World({ seed: 1 });
    for (let i = 0; i < 100; i++) w.tick(2);
    const maxLen = Math.max(...[...w.tracks.values()].map((t) => t.history.length));
    expect(maxLen).toBeLessThanOrEqual(60);
  });

  it('формує подію входу невизначеної цілі в закриту зону', () => {
    const w = new World({ seed: 7 });
    for (let i = 0; i < 200; i++) w.tick(2);
    const hits = w.events.filter((e) => e.type === 'zone_entry' && e.zoneId === 'z-4' && e.priority === 'critical');
    expect(hits.length).toBeGreaterThan(0);
  });
});

describe('World: події', () => {
  it('прострочує нову подію після нормативного часу (SLA)', () => {
    const { clock, now } = fixed();
    const w = new World({ seed: 1, now });
    const ev = w.events.find((e) => e.status === 'new' && e.priority === 'critical');
    const fresh = w.events.find((e) => e.status === 'new');
    expect(fresh).toBeTruthy();
    clock.t = Date.parse(ev.ts) + 3 * 60_000;
    expect(w.isOverdue(ev)).toBe(true);
    clock.t = Date.parse(ev.ts) + 60_000;
    expect(w.isOverdue(ev)).toBe(false);
  });

  it('потребує коментар для критичної події', () => {
    const w = new World({ seed: 1 });
    const crit = w.events.find((e) => e.priority === 'critical' && e.status === 'new');
    expect(w.resolveEvent(crit.id, 'acked', w.officers[1], '  ')).toEqual({ error: 'comment_required' });
    const ok = w.resolveEvent(crit.id, 'acked', w.officers[1], 'Взято в роботу');
    expect(ok.event.status).toBe('acked');
    expect(ok.event.ackBy).toBe(w.officers[1].name);
  });

  it('не дає змінити закриту подію', () => {
    const w = new World({ seed: 1 });
    const closed = w.events.find((e) => e.status === 'closed');
    expect(w.resolveEvent(closed.id, 'acked', w.officers[1], 'x')).toEqual({ error: 'already_closed' });
  });

  it('фільтрує журнал за пріоритетом і пошуком', () => {
    const w = new World({ seed: 1 });
    expect(w.listEvents({ priority: 'critical' }).every((e) => e.priority === 'critical')).toBe(true);
    const some = w.events[0];
    expect(w.listEvents({ q: some.id }).map((e) => e.id)).toContain(some.id);
  });
});

describe('World: зміна', () => {
  it('вимагає переглянути незакриті події перед прийманням', () => {
    const w = new World({ seed: 1 });
    const rep = w.getShift().pendingHandover;
    const res = w.accept(w.officers[1], rep.id, []);
    expect(res.error).toBe('not_reviewed');
    expect(res.unseen.length).toBeGreaterThan(0);
  });

  it('приймає зміну після перегляду і записує авторство', () => {
    const w = new World({ seed: 1 });
    const rep = w.getShift().pendingHandover;
    const res = w.accept(w.officers[1], rep.id, rep.openEventIds);
    expect(res.active.officerId).toBe(w.officers[1].id);
    expect(w.getShift().pendingHandover).toBeNull();
    expect(w.getShift().history[0].acceptedBy.id).toBe(w.officers[1].id);
  });

  it('передає зміну зі звітом і звільняє пульт', () => {
    const w = new World({ seed: 1 });
    const rep = w.getShift().pendingHandover;
    w.accept(w.officers[1], rep.id, rep.openEventIds);
    const out = w.handover(w.officers[1], 'Увага на рейд');
    expect(out.report.notes).toBe('Увага на рейд');
    expect(out.report.openEventIds.length).toBeGreaterThan(0);
    expect(w.getShift().active).toBeNull();
  });

  it('забороняє передавати зміну тому, хто не на зміні', () => {
    const w = new World({ seed: 1 });
    expect(w.handover(w.officers[2], '')).toEqual({ error: 'not_on_duty' });
  });
});
