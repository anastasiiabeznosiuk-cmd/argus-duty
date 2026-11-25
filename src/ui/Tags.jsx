import { Tag } from '@carbon/react';
import { ErrorFilled, WarningAltFilled, WarningFilled, InformationFilled, CheckmarkFilled, Time, Hourglass } from '@carbon/icons-react';
import { PRIORITY_LABEL, STATUS_LABEL } from '../lib/events.js';
import { HEALTH_LABEL } from '../lib/handover.js';

const PRIORITY_VIEW = {
  critical: { type: 'red', icon: ErrorFilled },
  high: { type: 'magenta', icon: WarningAltFilled },
  medium: { type: 'purple', icon: WarningFilled },
  low: { type: 'gray', icon: InformationFilled },
};

/** Пріоритет передається і кольором, і піктограмою, і текстом (вимога В-12: не лише кольором). */
export function PriorityTag({ priority, size = 'sm' }) {
  const v = PRIORITY_VIEW[priority];
  return (
    <Tag type={v.type} size={size} renderIcon={v.icon} data-priority={priority}>
      {PRIORITY_LABEL[priority]}
    </Tag>
  );
}

const STATUS_VIEW = {
  new: { type: 'blue', icon: Time },
  acked: { type: 'teal', icon: Hourglass },
  closed: { type: 'green', icon: CheckmarkFilled },
};

export function StatusTag({ status, size = 'sm' }) {
  const v = STATUS_VIEW[status];
  return (
    <Tag type={v.type} size={size} renderIcon={v.icon}>
      {STATUS_LABEL[status]}
    </Tag>
  );
}

export function OverdueTag({ size = 'sm' }) {
  return (
    <Tag type="high-contrast" size={size} renderIcon={Time} className="tag--overdue">
      Прострочена
    </Tag>
  );
}

const HEALTH_TYPE = { ok: 'green', degraded: 'purple', down: 'red' };
export function HealthTag({ health, size = 'sm' }) {
  return (
    <Tag type={HEALTH_TYPE[health]} size={size}>
      {HEALTH_LABEL[health]}
    </Tag>
  );
}
