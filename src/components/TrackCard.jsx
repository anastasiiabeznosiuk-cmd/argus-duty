import { Button, Tag } from '@carbon/react';
import { Close } from '@carbon/icons-react';
import { CLASS_LABEL, DOMAIN_LABEL, formatCoord, formatCourse, formatSpeed } from '../lib/geo.js';
import { formatTime } from '../lib/events.js';
import { PriorityTag } from '../ui/Tags.jsx';

const CLASS_TAG = { friendly: 'green', neutral: 'blue', unknown: 'purple', suspect: 'red' };

/** Картка цілі (поточний стан + пов’язані незакриті події). */
export function TrackCard({ track, events, zones, sourceName, onClose, onSelectEvent }) {
  if (!track) return null;
  const inZones = zones.filter((z) => track.zones?.includes(z.id));
  return (
    <aside className="trackcard" aria-label={`Ціль ${track.name}`}>
      <header className="trackcard__head">
        <div>
          <h2 className="trackcard__title">{track.name}</h2>
          <p className="trackcard__sub">
            {track.kindLabel} · {DOMAIN_LABEL[track.domain]}
          </p>
        </div>
        <Button kind="ghost" size="sm" hasIconOnly renderIcon={Close} iconDescription="Закрити картку" onClick={onClose} />
      </header>
      <Tag type={CLASS_TAG[track.classification]} size="sm">
        {CLASS_LABEL[track.classification]}
      </Tag>
      <dl className="trackcard__grid">
        <dt>Координати</dt>
        <dd>{formatCoord(track.lat, track.lon)}</dd>
        <dt>Курс / швидкість</dt>
        <dd>
          {formatCourse(track.cog)} / {formatSpeed(track.sog)}
        </dd>
        {track.alt != null && (
          <>
            <dt>Висота</dt>
            <dd>{track.alt} м</dd>
          </>
        )}
        <dt>Джерело</dt>
        <dd>{sourceName ?? track.sourceId}</dd>
        <dt>Зони</dt>
        <dd>{inZones.length ? inZones.map((z) => z.name).join(', ') : 'поза зонами'}</dd>
        <dt>Оновлено</dt>
        <dd>{formatTime(track.ts)}</dd>
      </dl>
      {events.length > 0 && (
        <>
          <h3 className="trackcard__h3">Пов’язані події</h3>
          <ul className="trackcard__events">
            {events.map((e) => (
              <li key={e.id}>
                <button type="button" className="linklike" onClick={() => onSelectEvent(e.id)}>
                  <PriorityTag priority={e.priority} /> {e.title}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
