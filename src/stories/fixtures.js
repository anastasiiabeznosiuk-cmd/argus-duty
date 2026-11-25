// Тестові дані для каталогу компонентів.
export const NOW = Date.parse('2026-11-17T10:00:00Z');
const iso = (minAgo) => new Date(NOW - minAgo * 60_000).toISOString();

export const events = [
  { id: 'E-0005', priority: 'critical', status: 'new', title: 'БпЛА БП-337: непізнана повітряна ціль у районі', ts: iso(12), type: 'air_unidentified', trackId: 'T-0034' },
  { id: 'E-0002', priority: 'critical', status: 'new', title: 'Вантажне судно MV-130: вхід у зону «Підхідний фарватер»', ts: iso(1), type: 'zone_entry', trackId: 'T-0002' },
  { id: 'E-0010', priority: 'high', status: 'new', title: 'Танкер MT-183: припинено передавання AIS', ts: iso(3), type: 'ais_lost', trackId: 'T-0012' },
  { id: 'E-0007', priority: 'medium', status: 'acked', title: 'Рибальське судно FV-234: вхід у зону «Зона рибальства»', ts: iso(30), type: 'zone_entry', trackId: 'T-0016', ackBy: 'Мельник Т. В.', comment: 'Огляд призначено' },
  { id: 'E-0013', priority: 'low', status: 'new', title: 'БпЛА БП-338: новий трек', ts: iso(4), type: 'new_track', trackId: 'T-0035' },
];

export const sources = [
  { id: 's-ais', name: 'AIS-приймач «Одеса»', type: 'ais', health: 'ok', lastMessageAt: NOW - 2_000 },
  { id: 's-rls1', name: 'РЛС-1 «Одеса»', type: 'radar', health: 'degraded', lastMessageAt: NOW - 12_000 },
  { id: 's-rls2', name: 'РЛС-2 «Південний»', type: 'radar', health: 'down', lastMessageAt: NOW - 95_000 },
  { id: 's-adsb', name: 'ADS-B-приймач', type: 'adsb', health: 'ok', lastMessageAt: NOW - 1_000 },
];

export const track = {
  id: 'T-0034',
  name: 'БП-337',
  kindLabel: 'БпЛА',
  domain: 'air',
  classification: 'unknown',
  lat: 46.5123,
  lon: 30.8741,
  cog: 214,
  sog: 62.4,
  alt: 320,
  sourceId: 's-rls1',
  zones: ['z-6'],
  ts: iso(0),
};

export const zones = [{ id: 'z-6', name: 'Повітряне обмеження', kind: 'air_restricted', domain: 'air', rings: [[[30.74, 46.46], [30.92, 46.46], [30.92, 46.58], [30.74, 46.58], [30.74, 46.46]]] }];
