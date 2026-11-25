// Допоміжні функції відображення цілей.
export const CLASS_LABEL = { friendly: 'Свій', neutral: 'Нейтральний', unknown: 'Невизначений', suspect: 'Підозрілий' };
export const CLASS_COLOR = { friendly: '#42be65', neutral: '#78a9ff', unknown: '#f1c21b', suspect: '#fa4d56' };
export const DOMAIN_LABEL = { surface: 'Надводна', air: 'Повітряна' };

export const formatCoord = (lat, lon) =>
  `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'пн. ш.' : 'пд. ш.'}, ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'сх. д.' : 'зх. д.'}`;

export const formatCourse = (cog) => `${String(Math.round(cog) % 360).padStart(3, '0')}°`;

/** Швидкість: надводні — у вузлах, повітряні — також у вузлах (так подає ADS-B). */
export const formatSpeed = (sog) => `${sog.toFixed(1)} вуз.`;
