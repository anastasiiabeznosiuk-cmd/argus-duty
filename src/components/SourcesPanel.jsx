import { HealthTag } from '../ui/Tags.jsx';
import { DataState } from '../ui/DataState.jsx';
import { formatDuration } from '../lib/events.js';

export const SOURCE_TYPE_LABEL = { ais: 'AIS', radar: 'РЛС', adsb: 'ADS-B', visual: 'Візуальне' };

/** Стан джерел даних (В-6): справність і «вік» останнього повідомлення. Дані старші за 30 с — застарілі. */
export function SourcesPanel({ sources, status, error, now, onRetry }) {
  return (
    <DataState status={status} error={error} isEmpty={sources.length === 0} onRetry={onRetry} emptyTitle="Джерел не знайдено" rows={3}>
      <ul className="sources" aria-label="Джерела даних">
        {sources.map((s) => {
          const age = Math.max(0, now - s.lastMessageAt);
          const stale = s.health === 'down' || age > 30_000;
          return (
            <li key={s.id} className="sources__item" data-health={s.health}>
              <div>
                <p className="sources__name">{s.name}</p>
                <p className="sources__meta">
                  {SOURCE_TYPE_LABEL[s.type] ?? s.type} · {stale ? `дані старші ${formatDuration(age)}` : 'дані свіжі'}
                </p>
              </div>
              <HealthTag health={s.health} />
            </li>
          );
        })}
      </ul>
    </DataState>
  );
}
