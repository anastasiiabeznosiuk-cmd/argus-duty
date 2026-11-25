import { Tag } from '@carbon/react';
import { Wifi, WifiOff, Renew } from '@carbon/icons-react';

const VIEW = {
  open: { type: 'green', icon: Wifi, text: 'Потік активний' },
  connecting: { type: 'cool-gray', icon: Renew, text: 'Підключення…' },
  stale: { type: 'purple', icon: WifiOff, text: 'Дані застарілі' },
  closed: { type: 'red', icon: WifiOff, text: 'Немає зв’язку' },
};

/** Стан каналу оновлень. Тексту достатньо без кольору (В-12). */
export function ConnectionBadge({ conn }) {
  const v = VIEW[conn] ?? VIEW.closed;
  return (
    <Tag type={v.type} size="md" renderIcon={v.icon} role="status" data-conn={conn}>
      {v.text}
    </Tag>
  );
}
