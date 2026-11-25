import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Select, SelectItem, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { useStore } from '../store.js';
import { useNow } from '../ui/hooks.js';
import { DataState } from '../ui/DataState.jsx';
import { OverdueTag, PriorityTag, StatusTag } from '../ui/Tags.jsx';
import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL, filterEvents, formatDateTime, isOverdue } from '../lib/events.js';

const options = (labels) => Object.entries(labels).map(([value, text]) => <SelectItem key={value} value={value} text={text} />);

/** Журнал подій: фільтри за статусом, пріоритетом, типом і пошук (В-7). */
export function EventsPage() {
  const navigate = useNavigate();
  const events = useStore((s) => s.events);
  const res = useStore((s) => s.eventsRes);
  const loadEvents = useStore((s) => s.loadEvents);
  const selectEvent = useStore((s) => s.selectEvent);
  const now = useNow();
  const [filters, setFilters] = useState({ status: '', priority: '', type: '', q: '' });
  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  const rows = useMemo(() => filterEvents(events, filters), [events, filters]);

  return (
    <div className="journal">
      <h1 className="page__title">Журнал подій</h1>
      <form className="filters" role="search" onSubmit={(e) => e.preventDefault()}>
        <Search id="f-q" size="md" labelText="Пошук" placeholder="Пошук за назвою, ціллю, номером" value={filters.q} onChange={set('q')} />
        <Select id="f-status" labelText="Статус" value={filters.status} onChange={set('status')}>
          <SelectItem value="" text="Усі" />
          {options(STATUS_LABEL)}
        </Select>
        <Select id="f-priority" labelText="Пріоритет" value={filters.priority} onChange={set('priority')}>
          <SelectItem value="" text="Усі" />
          {PRIORITIES.map((p) => (
            <SelectItem key={p} value={p} text={PRIORITY_LABEL[p]} />
          ))}
        </Select>
        <Select id="f-type" labelText="Тип" value={filters.type} onChange={set('type')}>
          <SelectItem value="" text="Усі" />
          {options(TYPE_LABEL)}
        </Select>
      </form>
      <p className="journal__count" aria-live="polite">
        Показано {rows.length} із {events.length}
      </p>
      <DataState
        status={res.status}
        error={res.error}
        isEmpty={rows.length === 0}
        onRetry={loadEvents}
        emptyTitle={events.length === 0 ? 'Журнал порожній' : 'Нічого не знайдено'}
        emptyText={events.length === 0 ? 'Подій за зміну ще не було.' : 'Змініть або скиньте фільтри.'}
        rows={8}
      >
        <div className="journal__table">
          <Table size="sm" aria-label="Журнал подій">
            <TableHead>
              <TableRow>
                <TableHeader>Час</TableHeader>
                <TableHeader>№</TableHeader>
                <TableHeader>Пріоритет</TableHeader>
                <TableHeader>Подія</TableHeader>
                <TableHeader>Тип</TableHeader>
                <TableHeader>Статус</TableHeader>
                <TableHeader>Опрацював</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((e) => (
                <TableRow
                  key={e.id}
                  tabIndex={0}
                  className="journal__row"
                  onClick={() => {
                    selectEvent(e.id);
                    navigate('/picture');
                  }}
                  onKeyDown={(k) => {
                    if (k.key === 'Enter') {
                      selectEvent(e.id);
                      navigate('/picture');
                    }
                  }}
                >
                  <TableCell>{formatDateTime(e.ts)}</TableCell>
                  <TableCell>{e.id}</TableCell>
                  <TableCell>
                    <PriorityTag priority={e.priority} />
                  </TableCell>
                  <TableCell>{e.title}</TableCell>
                  <TableCell>{TYPE_LABEL[e.type] ?? e.type}</TableCell>
                  <TableCell>
                    <StatusTag status={e.status} /> {isOverdue(e, now) && <OverdueTag />}
                  </TableCell>
                  <TableCell>{e.ackBy ? `${e.ackBy}${e.comment ? ` — ${e.comment}` : ''}` : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DataState>
    </div>
  );
}
