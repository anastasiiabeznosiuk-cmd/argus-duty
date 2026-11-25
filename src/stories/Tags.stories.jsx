import { HealthTag, OverdueTag, PriorityTag, StatusTag } from '../ui/Tags.jsx';
import { ConnectionBadge } from '../ui/ConnectionBadge.jsx';
import { Counters } from '../ui/Shell.jsx';

const row = { display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '1rem' };

export const Priorities = () => (
  <div style={row}>
    {['critical', 'high', 'medium', 'low'].map((p) => (
      <PriorityTag key={p} priority={p} />
    ))}
  </div>
);
export const Statuses = () => (
  <div style={row}>
    {['new', 'acked', 'closed'].map((s) => (
      <StatusTag key={s} status={s} />
    ))}
    <OverdueTag />
  </div>
);
export const SourceHealth = () => (
  <div style={row}>
    {['ok', 'degraded', 'down'].map((h) => (
      <HealthTag key={h} health={h} />
    ))}
  </div>
);
export const Connection = () => (
  <div style={row}>
    {['open', 'connecting', 'stale', 'closed'].map((c) => (
      <ConnectionBadge key={c} conn={c} />
    ))}
  </div>
);
export const EventCounters = () => <Counters counts={{ new: 7, critical: 2, overdue: 3 }} />;
export const EventCountersQuiet = () => <Counters counts={{ new: 0, critical: 0, overdue: 0 }} />;

export default { title: 'Позначки і лічильники' };
