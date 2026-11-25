import { SourcesPanel } from '../components/SourcesPanel.jsx';
import { TrackCard } from '../components/TrackCard.jsx';
import { NOW, events, sources, track, zones } from './fixtures.js';

const box = { width: 420, position: 'relative', height: 420 };

export const SourcesData = () => (
  <div style={box}>
    <SourcesPanel sources={sources} status="ready" now={NOW} />
  </div>
);
export const SourcesLoading = () => (
  <div style={box}>
    <SourcesPanel sources={[]} status="loading" now={NOW} />
  </div>
);
export const SourcesError = () => (
  <div style={box}>
    <SourcesPanel sources={[]} status="error" error="Немає зв’язку із сервером" now={NOW} onRetry={() => {}} />
  </div>
);
export const SourcesEmpty = () => (
  <div style={box}>
    <SourcesPanel sources={[]} status="ready" now={NOW} />
  </div>
);

export const TrackCardWithEvents = () => (
  <div style={{ ...box, height: 520 }}>
    <TrackCard track={track} events={events.slice(0, 1)} zones={zones} sourceName="РЛС-1 «Одеса»" onClose={() => {}} onSelectEvent={() => {}} />
  </div>
);
export const TrackCardSurface = () => (
  <div style={{ ...box, height: 420 }}>
    <TrackCard
      track={{ ...track, domain: 'surface', kindLabel: 'Танкер', name: 'MT-183', classification: 'neutral', alt: null, zones: [], sog: 9.1 }}
      events={[]}
      zones={zones}
      sourceName="AIS-приймач «Одеса»"
      onClose={() => {}}
      onSelectEvent={() => {}}
    />
  </div>
);

export default { title: 'Панелі' };
