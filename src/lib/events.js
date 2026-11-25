// Чиста логіка черги подій: пріоритети, нормативний час реагування (SLA), сортування, фільтрація.
export const PRIORITIES = ['critical', 'high', 'medium', 'low'];
export const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
export const PRIORITY_LABEL = { critical: 'Критична', high: 'Висока', medium: 'Середня', low: 'Низька' };
/** Нормативний час реагування, хвилини. Збігається зі значеннями сервера (GET /api/meta). */
export const SLA_MINUTES = { critical: 2, high: 5, medium: 15, low: 60 };

export const STATUS_LABEL = { new: 'Нова', acked: 'В роботі', closed: 'Закрита' };
export const TYPE_LABEL = {
  zone_entry: 'Вхід у зону',
  ais_lost: 'Втрата AIS',
  air_unidentified: 'Непізнана повітряна ціль',
  source_degraded: 'Стан джерела',
  new_track: 'Новий трек',
};

export const slaDeadline = (ev) => Date.parse(ev.ts) + SLA_MINUTES[ev.priority] * 60_000;

/** Подія прострочена, якщо вона досі нова (ніхто не відреагував) і SLA минув. */
export const isOverdue = (ev, now) => ev.status === 'new' && now > slaDeadline(ev);

/** Залишок часу до кінця SLA, мс (від'ємний — прострочення). */
export const slaLeftMs = (ev, now) => slaDeadline(ev) - now;

export const isOpen = (ev) => ev.status !== 'closed';

/**
 * Черга чергового: лише незакриті події. Нові — перед «в роботі»;
 * серед нових: прострочені, потім за пріоритетом, потім давніші першими.
 */
export function sortQueue(events, now) {
  const rank = (e) => (e.status === 'new' ? 0 : 1);
  return events
    .filter(isOpen)
    .slice()
    .sort((a, b) => {
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      const oa = isOverdue(a, now);
      const ob = isOverdue(b, now);
      if (oa !== ob) return oa ? -1 : 1;
      if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      return Date.parse(a.ts) - Date.parse(b.ts);
    });
}

export function countEvents(events, now) {
  const open = events.filter(isOpen);
  return {
    open: open.length,
    new: open.filter((e) => e.status === 'new').length,
    overdue: open.filter((e) => isOverdue(e, now)).length,
    critical: open.filter((e) => e.priority === 'critical').length,
  };
}

/** Фільтр журналу: status/priority/type — точний збіг, q — пошук за назвою, ідентифікатором і назвою цілі. */
export function filterEvents(events, { status, priority, type, q } = {}) {
  const needle = (q ?? '').trim().toLowerCase();
  return events.filter(
    (e) =>
      (!status || e.status === status) &&
      (!priority || e.priority === priority) &&
      (!type || e.type === type) &&
      (!needle || `${e.id} ${e.title} ${e.trackName ?? ''}`.toLowerCase().includes(needle)),
  );
}

/** «3 хв 05 с», «1 год 02 хв», «−2 хв 10 с» — з урахуванням знака. */
export function formatDuration(ms) {
  const sign = ms < 0 ? '−' : '';
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${sign}${h} год ${String(m).padStart(2, '0')} хв`;
  if (m > 0) return `${sign}${m} хв ${String(s).padStart(2, '0')} с`;
  return `${sign}${s} с`;
}

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
