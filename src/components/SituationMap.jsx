import { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';

// Воркер MapLibre збирається окремим файлом: без явного шляху Vite його не знаходить.
setWorkerUrl(workerUrl);
import { CLASS_COLOR } from '../lib/geo.js';

const STYLE = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    base: {
      type: 'raster',
      // Растр OpenStreetMap (CORS дозволено); потемніння — через paint-властивості шару нижче
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 17,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#161616' } },
    {
      id: 'base',
      type: 'raster',
      source: 'base',
      paint: { 'raster-brightness-max': 0.42, 'raster-saturation': -0.85, 'raster-contrast': 0.15 },
    },
  ],
};

const ZONE_COLOR = {
  restricted: '#fa4d56',
  air_restricted: '#ff832b',
  caution: '#f1c21b',
  anchorage: '#78a9ff',
  patrol: '#42be65',
};

const CENTER = [31.02, 46.4];

/** Надводні — п’ятикутник («корпус»), повітряні — стрілка: тип цілі читається за формою, а не лише за кольором (В-1, В-12). */
function drawIcon(shape) {
  const size = 40;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  const pts =
    shape === 'air'
      ? [[20, 3], [34, 35], [20, 28], [6, 35]]
      : [[20, 3], [31, 15], [31, 35], [9, 35], [9, 15]];
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

const trackFeatures = (tracks, selectedId, alertIds) => ({
  type: 'FeatureCollection',
  features: tracks.map((t) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
    properties: {
      id: t.id,
      name: t.name,
      domain: t.domain,
      classification: t.classification,
      cog: t.cog,
      selected: t.id === selectedId,
      alert: alertIds.has(t.id),
    },
  })),
});

const zoneFeatures = (zones) => ({
  type: 'FeatureCollection',
  features: zones.map((z) => ({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: z.rings },
    properties: { id: z.id, name: z.name, kind: z.kind },
  })),
});

/**
 * Карта зведеної обстановки. Дані приходять через props; карта нічого не завантажує сама.
 * focus = { lon, lat, key } — командою «центрувати» (зміна key повторно запускає переліт).
 */
export function SituationMap({ tracks, zones, layers, selectedTrackId, alertTrackIds, focus, onSelectTrack }) {
  const box = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelectTrack);
  onSelectRef.current = onSelectTrack;

  useEffect(() => {
    const map = new MapLibreMap({
      container: box.current,
      style: STYLE,
      center: CENTER,
      zoom: 8.6,
      attributionControl: { compact: true },
      // ?capture у адресі вмикає збереження буфера — лише для знімків екрана в записку
      canvasContextAttributes: { preserveDrawingBuffer: new URLSearchParams(location.search).has('capture') },
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('style.load', () => {
      map.addImage('ico-surface', drawIcon('surface'), { sdf: true });
      map.addImage('ico-air', drawIcon('air'), { sdf: true });
      map.addSource('zones', { type: 'geojson', data: zoneFeatures([]) });
      map.addSource('tracks', { type: 'geojson', data: trackFeatures([], null, new Set()) });
      const zoneColor = ['match', ['get', 'kind'], ...Object.entries(ZONE_COLOR).flat(), '#a8a8a8'];
      map.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: { 'fill-color': zoneColor, 'fill-opacity': 0.1 } });
      map.addLayer({ id: 'zones-line', type: 'line', source: 'zones', paint: { 'line-color': zoneColor, 'line-width': 1.5, 'line-dasharray': [3, 2] } });
      map.addLayer({
        id: 'zones-label',
        type: 'symbol',
        source: 'zones',
        layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-font': ['Noto Sans Regular'] },
        paint: { 'text-color': zoneColor, 'text-halo-color': '#161616', 'text-halo-width': 1.5 },
      });
      map.addLayer({
        id: 'tracks-alert',
        type: 'circle',
        source: 'tracks',
        filter: ['==', ['get', 'alert'], true],
        paint: { 'circle-radius': 16, 'circle-color': 'rgba(250,77,86,0.12)', 'circle-stroke-color': '#fa4d56', 'circle-stroke-width': 1.5 },
      });
      map.addLayer({
        id: 'tracks-selected',
        type: 'circle',
        source: 'tracks',
        filter: ['==', ['get', 'selected'], true],
        paint: { 'circle-radius': 20, 'circle-color': 'rgba(255,255,255,0)', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
      });
      map.addLayer({
        id: 'tracks-icons',
        type: 'symbol',
        source: 'tracks',
        layout: {
          'icon-image': ['match', ['get', 'domain'], 'air', 'ico-air', 'ico-surface'],
          'icon-rotate': ['get', 'cog'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-size': 0.5,
          'text-field': ['get', 'name'],
          'text-size': 10,
          'text-offset': [0, 1.6],
          'text-font': ['Noto Sans Regular'],
          'text-optional': true,
        },
        paint: {
          'icon-color': ['match', ['get', 'classification'], ...Object.entries(CLASS_COLOR).flat(), '#c6c6c6'],
          'text-color': '#f4f4f4',
          'text-halo-color': '#161616',
          'text-halo-width': 1.2,
        },
      });
      map.on('click', 'tracks-icons', (e) => onSelectRef.current?.(e.features[0].properties.id));
      map.on('mouseenter', 'tracks-icons', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'tracks-icons', () => (map.getCanvas().style.cursor = ''));
      box.current.dataset.ready = 'true';
      box.current.__map = map; // доступ до карти з інструментів налагодження і знімків екрана
      setReady(true);
    });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(box.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (ready) mapRef.current.getSource('zones').setData(zoneFeatures(zones));
  }, [ready, zones]);

  useEffect(() => {
    if (!ready) return;
    const visible = tracks.filter((t) => layers[t.domain]);
    mapRef.current.getSource('tracks').setData(trackFeatures(visible, selectedTrackId, alertTrackIds));
  }, [ready, tracks, layers, selectedTrackId, alertTrackIds]);

  useEffect(() => {
    if (ready && focus) mapRef.current.flyTo({ center: [focus.lon, focus.lat], zoom: Math.max(mapRef.current.getZoom(), 9.8), duration: 800 });
  }, [ready, focus]);

  return <div ref={box} className="map" role="img" aria-label="Карта зведеної обстановки" data-testid="situation-map" />;
}
