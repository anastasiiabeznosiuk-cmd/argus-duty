// Формування звіту передавання зміни з поточного стану: незакриті, прострочені події, справність джерел.
import { PRIORITY_LABEL, STATUS_LABEL, isOverdue, sortQueue, formatDateTime } from './events.js';

export const HEALTH_LABEL = { ok: 'справне', degraded: 'знижена якість', down: 'немає зв’язку' };

export function buildHandoverDraft({ events, sources, now }) {
  const open = sortQueue(events, now);
  return {
    open,
    overdue: open.filter((e) => isOverdue(e, now)),
    unacked: open.filter((e) => e.status === 'new'),
    badSources: sources.filter((s) => s.health !== 'ok'),
    counts: {
      open: open.length,
      new: open.filter((e) => e.status === 'new').length,
      overdue: open.filter((e) => isOverdue(e, now)).length,
      critical: open.filter((e) => e.priority === 'critical').length,
    },
  };
}

/** Текстовий вигляд звіту — для копіювання в доповідь. */
export function composeReportText(draft, notes, officer, now) {
  const lines = [
    `ЗВІТ ПЕРЕДАВАННЯ ЗМІНИ — ${formatDateTime(new Date(now).toISOString())}`,
    `Черговий: ${officer?.rank ?? ''} ${officer?.name ?? ''}`.trim(),
    '',
    `Незакритих подій: ${draft.counts.open} (нових ${draft.counts.new}, прострочених ${draft.counts.overdue}, критичних ${draft.counts.critical})`,
  ];
  for (const e of draft.open) {
    const flag = isOverdue(e, now) ? ' [ПРОСТРОЧЕНО]' : '';
    lines.push(`– ${e.id} ${PRIORITY_LABEL[e.priority]}, ${STATUS_LABEL[e.status]}${flag}: ${e.title}`);
  }
  lines.push('', 'Джерела з відхиленням:');
  if (draft.badSources.length === 0) lines.push('– немає');
  for (const s of draft.badSources) lines.push(`– ${s.name}: ${HEALTH_LABEL[s.health]}`);
  lines.push('', `Примітки чергового: ${notes?.trim() || '—'}`);
  return lines.join('\n');
}
