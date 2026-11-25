import { describe, it, expect } from 'vitest';
import { buildHandoverDraft, composeReportText } from '../../src/lib/handover.js';

const NOW = Date.parse('2026-11-17T10:00:00Z');
const ev = (id, priority, minAgo, status = 'new') => ({
  id,
  priority,
  status,
  title: `Подія ${id}`,
  ts: new Date(NOW - minAgo * 60_000).toISOString(),
});
const sources = [
  { id: 's1', name: 'AIS', health: 'ok' },
  { id: 's2', name: 'РЛС-2', health: 'down' },
];

describe('buildHandoverDraft', () => {
  const draft = buildHandoverDraft({
    events: [ev('a', 'critical', 10), ev('b', 'low', 1), ev('c', 'high', 3, 'acked'), ev('d', 'low', 1, 'closed')],
    sources,
    now: NOW,
  });
  it('містить лише незакриті події в порядку черги', () => {
    expect(draft.open.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });
  it('виділяє прострочені та нікому не передані події', () => {
    expect(draft.overdue.map((e) => e.id)).toEqual(['a']);
    expect(draft.unacked.map((e) => e.id)).toEqual(['a', 'b']);
  });
  it('перелічує джерела з відхиленням', () => {
    expect(draft.badSources.map((s) => s.id)).toEqual(['s2']);
  });
  it('рахує лічильники', () => {
    expect(draft.counts).toEqual({ open: 3, new: 2, overdue: 1, critical: 1 });
  });
});

describe('composeReportText', () => {
  it('включає події, джерела та примітки', () => {
    const draft = buildHandoverDraft({ events: [ev('a', 'critical', 10)], sources, now: NOW });
    const text = composeReportText(draft, 'Увага на рейд', { rank: 'майор', name: 'Коваль О. І.' }, NOW);
    expect(text).toContain('майор Коваль О. І.');
    expect(text).toContain('a Критична, Нова [ПРОСТРОЧЕНО]');
    expect(text).toContain('РЛС-2: немає зв’язку');
    expect(text).toContain('Примітки чергового: Увага на рейд');
  });
  it('пише «—» для порожніх приміток і «немає» для справних джерел', () => {
    const draft = buildHandoverDraft({ events: [], sources: [{ id: 's', name: 'AIS', health: 'ok' }], now: NOW });
    const text = composeReportText(draft, '  ', null, NOW);
    expect(text).toContain('Примітки чергового: —');
    expect(text).toContain('– немає');
  });
});
