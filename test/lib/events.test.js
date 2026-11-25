import { describe, it, expect } from 'vitest';
import { sortQueue, isOverdue, slaLeftMs, countEvents, filterEvents, formatDuration } from '../../src/lib/events.js';

const T0 = Date.parse('2026-11-17T10:00:00Z');
const ev = (id, priority, minAgo, status = 'new', extra = {}) => ({
  id,
  priority,
  status,
  title: `Подія ${id}`,
  trackName: null,
  type: 'zone_entry',
  ts: new Date(T0 - minAgo * 60_000).toISOString(),
  ...extra,
});

describe('SLA', () => {
  it('критична подія прострочується через 2 хв', () => {
    expect(isOverdue(ev('a', 'critical', 1), T0)).toBe(false);
    expect(isOverdue(ev('a', 'critical', 3), T0)).toBe(true);
  });
  it('межа SLA не вважається простроченням', () => {
    expect(isOverdue(ev('a', 'high', 5), T0)).toBe(false);
  });
  it('взята в роботу подія не прострочується', () => {
    expect(isOverdue(ev('a', 'critical', 60, 'acked'), T0)).toBe(false);
  });
  it('повертає від’ємний залишок після прострочення', () => {
    expect(slaLeftMs(ev('a', 'medium', 20), T0)).toBe(-5 * 60_000);
  });
});

describe('sortQueue', () => {
  it('виключає закриті події', () => {
    const q = sortQueue([ev('a', 'low', 1), ev('b', 'low', 1, 'closed')], T0);
    expect(q.map((e) => e.id)).toEqual(['a']);
  });
  it('ставить прострочені вище за непрострочені вищого пріоритету', () => {
    const q = sortQueue([ev('crit-fresh', 'critical', 1), ev('low-late', 'low', 90)], T0);
    expect(q.map((e) => e.id)).toEqual(['low-late', 'crit-fresh']);
  });
  it('серед однакового стану сортує за пріоритетом, потім давніші першими', () => {
    const q = sortQueue([ev('m1', 'medium', 3), ev('h1', 'high', 1), ev('m2', 'medium', 8)], T0);
    expect(q.map((e) => e.id)).toEqual(['h1', 'm2', 'm1']);
  });
  it('події «в роботі» йдуть після нових', () => {
    const q = sortQueue([ev('w', 'critical', 1, 'acked'), ev('n', 'low', 1)], T0);
    expect(q.map((e) => e.id)).toEqual(['n', 'w']);
  });
  it('не змінює вхідний масив', () => {
    const src = [ev('b', 'low', 1), ev('a', 'critical', 1)];
    sortQueue(src, T0);
    expect(src.map((e) => e.id)).toEqual(['b', 'a']);
  });
});

describe('countEvents', () => {
  it('рахує нові, прострочені й критичні', () => {
    const c = countEvents(
      [ev('a', 'critical', 5), ev('b', 'low', 1), ev('c', 'high', 1, 'acked'), ev('d', 'low', 1, 'closed')],
      T0,
    );
    expect(c).toEqual({ open: 3, new: 2, overdue: 1, critical: 1 });
  });
});

describe('filterEvents', () => {
  const list = [
    ev('E-1', 'high', 1, 'new', { title: 'Судно MV-101 увійшло', trackName: 'MV-101' }),
    ev('E-2', 'low', 1, 'closed', { type: 'ais_lost', title: 'Втрата AIS' }),
  ];
  it('фільтрує за статусом, пріоритетом і типом', () => {
    expect(filterEvents(list, { status: 'closed' }).map((e) => e.id)).toEqual(['E-2']);
    expect(filterEvents(list, { priority: 'high' }).map((e) => e.id)).toEqual(['E-1']);
    expect(filterEvents(list, { type: 'ais_lost' }).map((e) => e.id)).toEqual(['E-2']);
  });
  it('шукає без урахування регістру за назвою цілі та ідентифікатором', () => {
    expect(filterEvents(list, { q: 'mv-101' })).toHaveLength(1);
    expect(filterEvents(list, { q: 'e-2' })).toHaveLength(1);
    expect(filterEvents(list, { q: 'немає' })).toHaveLength(0);
  });
  it('без фільтрів повертає все', () => {
    expect(filterEvents(list)).toHaveLength(2);
  });
});

describe('formatDuration', () => {
  it('форматує секунди, хвилини та години', () => {
    expect(formatDuration(45_000)).toBe('45 с');
    expect(formatDuration(3 * 60_000 + 5000)).toBe('3 хв 05 с');
    expect(formatDuration(3_720_000)).toBe('1 год 02 хв');
  });
  it('зберігає знак для прострочення', () => {
    expect(formatDuration(-130_000)).toBe('−2 хв 10 с');
  });
});
