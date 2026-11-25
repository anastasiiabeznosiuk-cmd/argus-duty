// Імітація обстановки: рух цілей, стан джерел, формування подій. Не залежить від мережі — тестується окремо.
import { createRng } from './rng.js';
import { bearing, destination, distanceNm, pointInRing } from './geo.js';
import { AIR_KINDS, BBOX, OFFICERS, PRIORITY_LABEL, SOURCES, SURFACE_KINDS, SLA_MINUTES, ZONES } from './seed.js';

const HISTORY_LIMIT = 60; // як і в реальній системі: сервер тримає лише останні положення треку
const COOLDOWN_MS = 15 * 60_000; // повторні події для пари «ціль — зона» не частіше ніж раз на 15 хв

export class World {
  constructor({ seed = 7, speed = 8, now = () => Date.now() } = {}) {
    this.rng = createRng(seed);
    this.speed = speed; // коефіцієнт прискорення часу, щоб рух був помітний на карті
    this.now = now;
    this.tracks = new Map();
    this.events = [];
    this.sources = SOURCES.map((s) => ({ ...s, health: 'ok', lastMessageAt: this.now() }));
    this.zones = ZONES;
    this.officers = OFFICERS;
    this.shift = { active: null, pendingHandover: null, history: [] };
    this.cooldown = new Map();
    this.seq = { event: 0, track: 0, report: 0 };
    this.listeners = new Set();
    this.#spawn();
    this.#seedEvents();
    this.#seedShift();
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  #emit(msg) {
    for (const fn of this.listeners) fn(msg);
  }

  // ---------------------------------------------------------------- початкова обстановка
  #randomPoint() {
    return {
      lon: this.rng.range(BBOX.west + 0.05, BBOX.east - 0.02),
      lat: this.rng.range(BBOX.south + 0.03, BBOX.north - 0.1),
    };
  }

  #route(n = 4) {
    return Array.from({ length: n }, () => this.#randomPoint());
  }

  #makeTrack(def, domain, labelIndex) {
    const id = `T-${String(++this.seq.track).padStart(4, '0')}`;
    const start = this.#randomPoint();
    const route = this.#route();
    const track = {
      id,
      domain,
      kind: def.kind,
      kindLabel: def.label,
      name: `${def.prefix}-${String(100 + labelIndex * 7 + this.rng.int(0, 6))}`,
      classification: def.classification,
      sourceId: def.source,
      lat: start.lat,
      lon: start.lon,
      sog: this.rng.range(def.sog[0], def.sog[1]),
      cog: 0,
      alt: domain === 'air' ? Math.round(this.rng.range(def.alt[0], def.alt[1])) : null,
      silentUntil: 0,
      route,
      routeIdx: 0,
      zonesInside: new Set(),
      ts: new Date(this.now()).toISOString(),
      history: [],
    };
    track.cog = bearing(track, route[0]);
    this.tracks.set(id, track);
    return track;
  }

  #spawn() {
    let i = 0;
    for (const def of SURFACE_KINDS) for (let k = 0; k < def.count; k++) this.#makeTrack(def, 'surface', i++);
    for (const def of AIR_KINDS) for (let k = 0; k < def.count; k++) this.#makeTrack(def, 'air', i++);
    // Сценарні цілі: невизначена ціль іде до закритої зони, БпЛА — до повітряного обмеження.
    const intruder = [...this.tracks.values()].find((t) => t.kind === 'unknown');
    intruder.lon = 30.97;
    intruder.lat = 46.43;
    intruder.sog = 14;
    intruder.route = [
      { lon: 31.08, lat: 46.44 },
      { lon: 31.2, lat: 46.3 },
      { lon: 30.9, lat: 46.3 },
    ];
    intruder.cog = bearing(intruder, intruder.route[0]);
    const uav = [...this.tracks.values()].find((t) => t.kind === 'uav');
    uav.lon = 30.97;
    uav.lat = 46.5;
    uav.route = [
      { lon: 30.86, lat: 46.52 },
      { lon: 30.78, lat: 46.4 },
      { lon: 31.0, lat: 46.55 },
    ];
    uav.cog = bearing(uav, uav.route[0]);
    for (const t of this.tracks.values()) this.#syncZones(t);
  }

  #seedEvents() {
    const now = this.now();
    const tracks = [...this.tracks.values()];
    const samples = [
      ['ais_lost', 'high', 95],
      ['zone_entry', 'critical', 41],
      ['source_degraded', 'medium', 130],
      ['zone_entry', 'high', 62],
      ['air_unidentified', 'critical', 12],
      ['ais_lost', 'medium', 210],
      ['zone_entry', 'medium', 33],
      ['new_track', 'low', 300],
      ['zone_entry', 'low', 180],
      ['ais_lost', 'high', 7],
      ['air_unidentified', 'high', 25],
      ['new_track', 'low', 360],
      ['zone_entry', 'medium', 4],
      ['ais_lost', 'medium', 52],
    ];
    const pick = (pred, i) => {
      const pool = tracks.filter(pred);
      return pool[i % pool.length];
    };
    samples.forEach(([type, priority, ageMin], i) => {
      let track = null;
      let zone = null;
      if (type === 'zone_entry') {
        zone = this.zones[i % this.zones.length];
        track = pick((t) => t.domain === zone.domain, i * 3 + 1);
      } else if (type === 'ais_lost') track = pick((t) => t.sourceId === 's-ais', i + 2);
      else if (type === 'air_unidentified') track = pick((t) => t.domain === 'air' && t.classification !== 'neutral' && t.classification !== 'friendly', i);
      else if (type === 'new_track') track = pick(() => true, i * 5);
      const title = type === 'source_degraded' ? 'Джерело «РЛС-2 «Південний»»: знижена якість' : undefined;
      const ev = this.#createEvent({ type, priority, track, zone, ts: now - ageMin * 60_000, silent: true, title });
      // частина давніших подій уже опрацьована попередньою зміною
      if (ageMin > 150) {
        ev.status = 'closed';
        ev.ackBy = this.officers[0].name;
        ev.ackAt = new Date(now - (ageMin - 20) * 60_000).toISOString();
        ev.comment = 'Опрацьовано, загрози немає.';
      }
    });
    this.events.sort((a, b) => b.ts.localeCompare(a.ts));
  }

  #seedShift() {
    const now = this.now();
    const prev = this.officers[0];
    this.shift.pendingHandover = this.#buildReport(
      prev,
      new Date(now - 8 * 3_600_000).toISOString(),
      'Район спокійний. Невизначену ціль у районі рейду тримати під спостереженням. РЛС-2 періодично втрачає ціль.',
      new Date(now - 4 * 60_000).toISOString(),
    );
  }

  #buildReport(officer, shiftStartedAt, notes, createdAt = new Date(this.now()).toISOString()) {
    const open = this.events.filter((e) => e.status !== 'closed');
    return {
      id: `R-${String(++this.seq.report).padStart(3, '0')}`,
      from: { id: officer.id, name: officer.name, rank: officer.rank },
      createdAt,
      shiftStartedAt,
      notes,
      openEventIds: open.map((e) => e.id),
      overdueEventIds: open.filter((e) => this.isOverdue(e)).map((e) => e.id),
      sourcesSnapshot: this.sources.map((s) => ({ id: s.id, name: s.name, health: s.health })),
      counts: this.counts(),
      acceptedBy: null,
      acceptedAt: null,
    };
  }

  // ---------------------------------------------------------------- події
  isOverdue(ev, at = this.now()) {
    if (ev.status !== 'new') return false;
    return at - Date.parse(ev.ts) > SLA_MINUTES[ev.priority] * 60_000;
  }

  counts() {
    const open = this.events.filter((e) => e.status !== 'closed');
    return {
      open: open.length,
      new: open.filter((e) => e.status === 'new').length,
      overdue: open.filter((e) => this.isOverdue(e)).length,
      critical: open.filter((e) => e.priority === 'critical').length,
    };
  }

  #createEvent({ type, priority, track, zone = null, ts = this.now(), silent = false, title }) {
    const ev = {
      id: `E-${String(++this.seq.event).padStart(4, '0')}`,
      type,
      priority,
      trackId: track?.id ?? null,
      trackName: track?.name ?? null,
      domain: track?.domain ?? null,
      zoneId: zone?.id ?? null,
      title: title ?? this.#title(type, track, zone),
      ts: new Date(ts).toISOString(),
      status: 'new',
      ackBy: null,
      ackAt: null,
      comment: '',
    };
    this.events.unshift(ev);
    if (!silent) this.#emit({ type: 'event.new', event: this.publicEvent(ev) });
    return ev;
  }

  #title(type, track, zone) {
    const who = track ? `${track.kindLabel} ${track.name}` : 'Джерело';
    switch (type) {
      case 'zone_entry':
        return `${who}: вхід у зону «${zone.name}»`;
      case 'ais_lost':
        return `${who}: припинено передавання AIS`;
      case 'air_unidentified':
        return `${who}: непізнана повітряна ціль у районі`;
      case 'source_degraded':
        return 'Деградація джерела даних';
      case 'new_track':
        return `${who}: новий трек`;
      default:
        return who;
    }
  }

  publicEvent(ev) {
    return { ...ev, overdue: this.isOverdue(ev), priorityLabel: PRIORITY_LABEL[ev.priority] };
  }

  listEvents({ status, priority, type, q, limit = 200 } = {}) {
    const needle = q?.toLowerCase();
    return this.events
      .filter((e) => (!status || e.status === status) && (!priority || e.priority === priority) && (!type || e.type === type))
      .filter((e) => !needle || `${e.title} ${e.trackName ?? ''} ${e.id}`.toLowerCase().includes(needle))
      .slice(0, limit)
      .map((e) => this.publicEvent(e));
  }

  /** status: 'acked' (взято в роботу) або 'closed' (закрито). Критичні події потребують коментаря. */
  resolveEvent(id, status, officer, comment = '') {
    const ev = this.events.find((e) => e.id === id);
    if (!ev) return { error: 'not_found' };
    if (ev.status === 'closed') return { error: 'already_closed' };
    if (ev.priority === 'critical' && !comment.trim()) return { error: 'comment_required' };
    ev.status = status;
    ev.ackBy = officer.name;
    ev.ackAt = new Date(this.now()).toISOString();
    ev.comment = comment.trim();
    const pub = this.publicEvent(ev);
    this.#emit({ type: 'event.update', event: pub });
    return { event: pub };
  }

  // ---------------------------------------------------------------- рух і правила
  #syncZones(track) {
    const inside = new Set();
    for (const z of this.zones) {
      if (z.domain !== track.domain) continue;
      if (pointInRing(track, z.rings[0])) inside.add(z.id);
    }
    track.zonesInside = inside;
  }

  #cooldownOk(key) {
    const t = this.now();
    if ((this.cooldown.get(key) ?? 0) > t) return false;
    this.cooldown.set(key, t + COOLDOWN_MS);
    return true;
  }

  tick(realDtSec = 2) {
    const nowMs = this.now();
    const dtHours = (realDtSec * this.speed) / 3600;
    const updates = [];
    for (const t of this.tracks.values()) {
      const target = t.route[t.routeIdx];
      if (distanceNm(t, target) < 0.4 + t.sog * dtHours) {
        t.routeIdx = (t.routeIdx + 1) % t.route.length;
      }
      t.cog = bearing(t, t.route[t.routeIdx]);
      const p = destination(t, t.cog, t.sog * dtHours);
      t.lat = p.lat;
      t.lon = p.lon;
      t.sog = Math.max(1, t.sog + this.rng.range(-0.15, 0.15));
      t.ts = new Date(nowMs).toISOString();
      const silent = t.silentUntil > nowMs;
      if (!silent) {
        t.history.push({ lat: t.lat, lon: t.lon, ts: t.ts });
        if (t.history.length > HISTORY_LIMIT) t.history.shift();
        updates.push(this.publicTrack(t));
      }
      this.#applyRules(t, nowMs);
    }
    this.#tickSources(nowMs);
    this.#emit({ type: 'track.batch', tracks: updates, ts: new Date(nowMs).toISOString() });
    this.#emit({ type: 'source.batch', sources: this.listSources() });
    return updates;
  }

  #applyRules(t, nowMs) {
    const before = t.zonesInside;
    this.#syncZones(t);
    for (const zid of t.zonesInside) {
      if (before.has(zid)) continue;
      const zone = this.zones.find((z) => z.id === zid);
      const hot = zone.kind === 'restricted' || zone.kind === 'air_restricted';
      const foreign = t.classification === 'unknown' || t.classification === 'suspect';
      if (!hot && !foreign) continue;
      if (hot && t.classification === 'friendly') continue;
      if (!this.#cooldownOk(`zone:${t.id}:${zid}`)) continue;
      const priority = hot ? (foreign ? 'critical' : 'high') : 'low';
      this.#createEvent({ type: 'zone_entry', priority, track: t, zone });
    }
    if (t.domain === 'surface' && t.sourceId === 's-ais' && t.silentUntil <= nowMs && this.rng.chance(0.0012)) {
      t.silentUntil = nowMs + this.rng.range(40_000, 90_000);
      if (this.#cooldownOk(`ais:${t.id}`)) this.#createEvent({ type: 'ais_lost', priority: 'medium', track: t });
    }
  }

  #tickSources(nowMs) {
    for (const s of this.sources) {
      if (s.health !== 'down') s.lastMessageAt = nowMs;
      if (this.rng.chance(0.002)) {
        const next = s.health === 'ok' ? this.rng.pick(['degraded', 'down']) : 'ok';
        s.health = next;
        this.#emit({ type: 'source.update', source: this.publicSource(s) });
        if (next !== 'ok') {
          this.#createEvent({
            type: 'source_degraded',
            priority: next === 'down' ? 'high' : 'medium',
            track: null,
            title: `Джерело «${s.name}»: ${next === 'down' ? 'немає зв’язку' : 'знижена якість'}`,
          });
        }
      }
    }
  }

  publicTrack(t) {
    // eslint-disable-next-line no-unused-vars
    const { route, routeIdx, zonesInside, silentUntil, history, ...rest } = t;
    return { ...rest, zones: [...zonesInside] };
  }

  publicSource(s) {
    return { ...s, ageSec: Math.round((this.now() - s.lastMessageAt) / 1000) };
  }

  listTracks() {
    return [...this.tracks.values()].map((t) => this.publicTrack(t));
  }

  listSources() {
    return this.sources.map((s) => this.publicSource(s));
  }

  // ---------------------------------------------------------------- зміна
  getShift() {
    return this.shift;
  }

  /** Вхід чергового: якщо поточної зміни немає і немає звіту на приймання — зміна починається одразу. */
  startShiftIfFree(officer) {
    if (!this.shift.active && !this.shift.pendingHandover) {
      this.shift.active = {
        officerId: officer.id,
        name: officer.name,
        rank: officer.rank,
        startedAt: new Date(this.now()).toISOString(),
      };
    }
  }

  handover(officer, notes) {
    if (!this.shift.active || this.shift.active.officerId !== officer.id) return { error: 'not_on_duty' };
    const report = this.#buildReport(officer, this.shift.active.startedAt, notes ?? '');
    this.shift.pendingHandover = report;
    this.shift.active = null;
    this.#emit({ type: 'shift.update' });
    return { report };
  }

  /** Приймання: черговий має переглянути всі незакриті події зі звіту. */
  accept(officer, reportId, reviewedEventIds = []) {
    const rep = this.shift.pendingHandover;
    if (!rep || rep.id !== reportId) return { error: 'no_pending' };
    if (this.shift.active) return { error: 'shift_active' };
    const unseen = rep.openEventIds.filter((id) => {
      const ev = this.events.find((e) => e.id === id);
      return ev && ev.status !== 'closed' && !reviewedEventIds.includes(id);
    });
    if (unseen.length) return { error: 'not_reviewed', unseen };
    rep.acceptedBy = { id: officer.id, name: officer.name };
    rep.acceptedAt = new Date(this.now()).toISOString();
    this.shift.history.unshift(rep);
    this.shift.pendingHandover = null;
    this.shift.active = { officerId: officer.id, name: officer.name, rank: officer.rank, startedAt: rep.acceptedAt };
    this.#emit({ type: 'shift.update' });
    return { active: this.shift.active };
  }
}
