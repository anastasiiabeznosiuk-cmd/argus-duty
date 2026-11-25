import { useRef } from 'react';
import { Button } from '@carbon/react';
import { PriorityTag, StatusTag, OverdueTag } from '../ui/Tags.jsx';
import { DataState } from '../ui/DataState.jsx';
import { isOverdue, slaLeftMs, sortQueue, formatDuration, formatTime } from '../lib/events.js';

function SlaTimer({ event, now }) {
  if (event.status !== 'new') return null;
  const left = slaLeftMs(event, now);
  return (
    <span className={`sla ${left < 0 ? 'sla--late' : ''}`} data-testid={`sla-${event.id}`}>
      {left < 0 ? `прострочено ${formatDuration(-left)}` : `до кінця реагування ${formatDuration(left)}`}
    </span>
  );
}

/**
 * Черга подій чергового (В-2, В-5, В-12).
 * Клавіатура: ↑/↓ — вибір, Enter — показати на карті, A — взяти в роботу, C — закрити.
 */
export function EventQueue({ events, status, error, now, selectedId, onSelect, onResolve, onRetry }) {
  const listRef = useRef(null);
  const queue = sortQueue(events, now);

  const move = (delta) => {
    if (queue.length === 0) return;
    const idx = queue.findIndex((e) => e.id === selectedId);
    const next = queue[Math.min(queue.length - 1, Math.max(0, idx + delta))] ?? queue[0];
    onSelect(next.id);
    requestAnimationFrame(() => listRef.current?.querySelector(`[data-id="${next.id}"]`)?.scrollIntoView?.({ block: 'nearest' }));
  };

  const onKeyDown = (e) => {
    if (e.target.closest('button')) return;
    const selected = queue.find((x) => x.id === selectedId);
    if (e.key === 'ArrowDown') (e.preventDefault(), move(1));
    else if (e.key === 'ArrowUp') (e.preventDefault(), move(-1));
    else if (e.key === 'Enter' && selected) onSelect(selected.id);
    else if ((e.key === 'a' || e.key === 'A') && selected && selected.status === 'new') onResolve(selected, 'ack');
    else if ((e.key === 'c' || e.key === 'C') && selected) onResolve(selected, 'close');
  };

  return (
    <DataState
      status={status}
      error={error}
      isEmpty={queue.length === 0}
      onRetry={onRetry}
      emptyTitle="Незакритих подій немає"
      emptyText="Усі події опрацьовано. Нові з’являтимуться тут автоматично."
    >
      <ul
        ref={listRef}
        className="queue"
        role="listbox"
        aria-label="Черга подій"
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-activedescendant={selectedId ? `ev-${selectedId}` : undefined}
      >
        {queue.map((ev) => {
          const late = isOverdue(ev, now);
          const selected = ev.id === selectedId;
          return (
            <li
              key={ev.id}
              id={`ev-${ev.id}`}
              data-id={ev.id}
              role="option"
              aria-selected={selected}
              className={`queue__item ${selected ? 'is-selected' : ''} ${late ? 'is-late' : ''}`}
              onClick={() => onSelect(ev.id)}
            >
              <div className="queue__tags">
                <PriorityTag priority={ev.priority} />
                <StatusTag status={ev.status} />
                {late && <OverdueTag />}
              </div>
              <p className="queue__title">{ev.title}</p>
              <p className="queue__meta">
                <span>{ev.id}</span>
                <span>{formatTime(ev.ts)}</span>
                <SlaTimer event={ev} now={now} />
              </p>
              {ev.status === 'acked' && (
                <p className="queue__meta">
                  Взяв у роботу: {ev.ackBy}
                  {ev.comment ? ` — ${ev.comment}` : ''}
                </p>
              )}
              {selected && (
                <div className="queue__actions">
                  {ev.status === 'new' && (
                    <Button size="sm" kind="primary" onClick={() => onResolve(ev, 'ack')}>
                      Взяти в роботу
                    </Button>
                  )}
                  <Button size="sm" kind="tertiary" onClick={() => onResolve(ev, 'close')}>
                    Закрити
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </DataState>
  );
}
