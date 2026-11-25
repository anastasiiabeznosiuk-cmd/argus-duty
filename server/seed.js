// Початкові дані тестового сервера ARGUS: зони, джерела, чергові, зразки назв.
export const OFFICERS = [
  { id: 'o-1', name: 'Коваль О. І.', rank: 'майор', callsign: 'Берег-1' },
  { id: 'o-2', name: 'Мельник Т. В.', rank: 'капітан', callsign: 'Берег-2' },
  { id: 'o-3', name: 'Шевчук Д. А.', rank: 'старший лейтенант', callsign: 'Берег-3' },
];

const rect = (w, s, e, n) => [[[w, s], [e, s], [e, n], [w, n], [w, s]]];

export const ZONES = [
  { id: 'z-1', name: 'Акваторія порту', kind: 'caution', domain: 'surface', rings: rect(30.755, 46.485, 30.8, 46.52) },
  { id: 'z-2', name: 'Підхідний фарватер', kind: 'caution', domain: 'surface', rings: rect(30.8, 46.44, 30.95, 46.49) },
  { id: 'z-3', name: 'Якірна стоянка', kind: 'anchorage', domain: 'surface', rings: rect(30.88, 46.36, 31.02, 46.43) },
  { id: 'z-4', name: 'Закрита зона (рейд)', kind: 'restricted', domain: 'surface', rings: rect(31.02, 46.4, 31.14, 46.48) },
  { id: 'z-5', name: 'Район патрулювання', kind: 'patrol', domain: 'surface', rings: rect(30.82, 46.28, 31.0, 46.35) },
  { id: 'z-6', name: 'Повітряне обмеження', kind: 'air_restricted', domain: 'air', rings: rect(30.74, 46.46, 30.92, 46.58) },
  { id: 'z-7', name: 'Зона рибальства', kind: 'caution', domain: 'surface', rings: rect(31.1, 46.25, 31.28, 46.36) },
];

export const SOURCES = [
  { id: 's-ais', name: 'AIS-приймач «Одеса»', type: 'ais' },
  { id: 's-rls1', name: 'РЛС-1 «Одеса»', type: 'radar' },
  { id: 's-rls2', name: 'РЛС-2 «Південний»', type: 'radar' },
  { id: 's-adsb', name: 'ADS-B-приймач', type: 'adsb' },
  { id: 's-post', name: 'Пост спостереження ПС-3', type: 'visual' },
];

export const SURFACE_KINDS = [
  { kind: 'cargo', label: 'Вантажне судно', prefix: 'MV', count: 9, classification: 'neutral', sog: [6, 14], source: 's-ais' },
  { kind: 'tanker', label: 'Танкер', prefix: 'MT', count: 5, classification: 'neutral', sog: [5, 12], source: 's-ais' },
  { kind: 'fishing', label: 'Рибальське судно', prefix: 'FV', count: 6, classification: 'neutral', sog: [2, 7], source: 's-ais' },
  { kind: 'patrol', label: 'Патрульний катер', prefix: 'ПК', count: 3, classification: 'friendly', sog: [8, 22], source: 's-rls1' },
  { kind: 'unknown', label: 'Невизначена ціль', prefix: 'НЦ', count: 4, classification: 'unknown', sog: [4, 18], source: 's-rls2' },
];

export const AIR_KINDS = [
  { kind: 'aircraft', label: 'Цивільне ПС', prefix: 'AC', count: 4, classification: 'neutral', sog: [150, 260], alt: [2000, 9000], source: 's-adsb' },
  { kind: 'helicopter', label: 'Гелікоптер', prefix: 'ГВ', count: 2, classification: 'friendly', sog: [70, 110], alt: [150, 600], source: 's-adsb' },
  { kind: 'uav', label: 'БпЛА', prefix: 'БП', count: 3, classification: 'unknown', sog: [45, 90], alt: [100, 700], source: 's-rls1' },
  { kind: 'aircraft', label: 'Повітряна ціль невизначена', prefix: 'ПЦ', count: 1, classification: 'suspect', sog: [180, 240], alt: [500, 1500], source: 's-rls2' },
];

export const CLASSIFICATION_LABEL = {
  friendly: 'свій',
  neutral: 'нейтральний',
  unknown: 'невизначений',
  suspect: 'підозрілий',
};

export const PRIORITY_LABEL = {
  critical: 'критична',
  high: 'висока',
  medium: 'середня',
  low: 'низька',
};

/** Нормативний час реагування на подію, хвилини (SLA). Повторюється на клієнті. */
export const SLA_MINUTES = { critical: 2, high: 5, medium: 15, low: 60 };

export const BBOX = { west: 30.78, south: 46.22, east: 31.32, north: 46.56 };
