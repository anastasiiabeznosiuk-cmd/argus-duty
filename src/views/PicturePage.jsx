import { useMemo, useState } from 'react';
import { Checkbox } from '@carbon/react';
import { useStore } from '../store.js';
import { useNow } from '../ui/hooks.js';
import { DataState } from '../ui/DataState.jsx';
import { SituationMap } from '../components/SituationMap.jsx';
import { EventQueue } from '../components/EventQueue.jsx';
import { SourcesPanel } from '../components/SourcesPanel.jsx';
import { TrackCard } from '../components/TrackCard.jsx';
import { ResolveDialog } from '../components/ResolveDialog.jsx';
import { isOpen } from '../lib/events.js';

const centroid = (zone) => {
  const ring = zone.rings[0];
  return { lon: ring.reduce((s, p) => s + p[0], 0) / ring.length, lat: ring.reduce((s, p) => s + p[1], 0) / ring.length };
};

/** Зведена обстановка: карта надводних і повітряних цілей + черга подій + джерела (В-1…В-6). */
export function PicturePage() {
  const s = useStore();
  const now = useNow();
  const [focus, setFocus] = useState(null);
  const [resolving, setResolving] = useState(null);

  const trackList = useMemo(() => Object.values(s.tracks), [s.tracks]);
  const alertTrackIds = useMemo(
    () => new Set(s.events.filter((e) => isOpen(e) && e.trackId && (e.priority === 'critical' || e.priority === 'high')).map((e) => e.trackId)),
    [s.events],
  );
  const counts = useMemo(
    () => ({ surface: trackList.filter((t) => t.domain === 'surface').length, air: trackList.filter((t) => t.domain === 'air').length }),
    [trackList],
  );
  const selectedTrack = s.selectedTrackId ? s.tracks[s.selectedTrackId] : null;
  const related = selectedTrack ? s.events.filter((e) => isOpen(e) && e.trackId === selectedTrack.id) : [];
  const sourceName = (id) => s.sources.find((x) => x.id === id)?.name;

  const selectEvent = (id) => {
    s.selectEvent(id);
    const ev = s.events.find((e) => e.id === id);
    const track = ev?.trackId ? s.tracks[ev.trackId] : null;
    const zone = ev?.zoneId ? s.zones.find((z) => z.id === ev.zoneId) : null;
    const point = track ?? (zone ? centroid(zone) : null);
    if (point) setFocus({ lon: point.lon, lat: point.lat, key: Date.now() });
  };

  return (
    <div className="picture">
      <section className="picture__map" aria-label="Карта обстановки">
        <DataState
          status={s.tracksRes.status}
          error={s.tracksRes.error}
          isEmpty={trackList.length === 0}
          onRetry={s.loadTracks}
          emptyTitle="Цілей у районі немає"
          emptyText="Джерела не передають жодного треку. Перевірте справність джерел."
          rows={8}
        >
          <SituationMap
            tracks={trackList}
            zones={s.zones}
            layers={s.layers}
            selectedTrackId={s.selectedTrackId}
            alertTrackIds={alertTrackIds}
            focus={focus}
            onSelectTrack={s.selectTrack}
          />
          <fieldset className="layers">
            <legend className="visually-hidden">Шари карти</legend>
            <Checkbox id="layer-surface" labelText={`Надводні (${counts.surface})`} checked={s.layers.surface} onChange={() => s.toggleLayer('surface')} />
            <Checkbox id="layer-air" labelText={`Повітряні (${counts.air})`} checked={s.layers.air} onChange={() => s.toggleLayer('air')} />
          </fieldset>
          <TrackCard
            track={selectedTrack}
            events={related}
            zones={s.zones}
            sourceName={selectedTrack && sourceName(selectedTrack.sourceId)}
            onClose={() => s.selectTrack(null)}
            onSelectEvent={selectEvent}
          />
        </DataState>
      </section>

      <aside className="picture__side">
        <section className="panel panel--grow">
          <h2 className="panel__title">Черга подій</h2>
          <EventQueue
            events={s.events}
            status={s.eventsRes.status}
            error={s.eventsRes.error}
            now={now}
            selectedId={s.selectedEventId}
            onSelect={selectEvent}
            onResolve={(event, action) => setResolving({ event, action })}
            onRetry={s.loadEvents}
          />
        </section>
        <section className="panel">
          <h2 className="panel__title">Джерела даних</h2>
          <SourcesPanel sources={s.sources} status={s.sourcesRes.status} error={s.sourcesRes.error} now={now} onRetry={s.loadSources} />
        </section>
      </aside>

      {resolving && (
        <ResolveDialog
          event={resolving.event}
          action={resolving.action}
          onClose={() => setResolving(null)}
          onSubmit={(comment) => s.resolveEvent(resolving.event.id, resolving.action, comment)}
        />
      )}
    </div>
  );
}
