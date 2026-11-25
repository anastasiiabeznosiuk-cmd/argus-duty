// Сховище стану (Zustand): сеанс, цілі, події, джерела, вибір. Єдине місце, куди пишуть api.js і line.js.
import { create } from 'zustand';
import { api, configureApi } from './api.js';

const SESSION_KEY = 'argus.session';

const readSession = () => {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) ?? null;
  } catch {
    return null;
  }
};
const writeSession = (value) => {
  try {
    if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* сховище недоступне — сеанс живе лише в пам’яті */
  }
};

const resource = () => ({ status: 'idle', error: null });
const toMessage = (e) => e?.message ?? 'Невідома помилка';

const initialData = () => ({
  tracks: {},
  events: [],
  sources: [],
  zones: [],
  tracksRes: resource(),
  eventsRes: resource(),
  sourcesRes: resource(),
  zonesRes: resource(),
  selectedTrackId: null,
  selectedEventId: null,
  layers: { surface: true, air: true },
  conn: 'closed', // closed | connecting | open | stale
  lastMessageAt: 0,
});

export const useStore = create((set, get) => ({
  session: readSession(), // { token, officer }
  ...initialData(),

  // ---------------------------------------------------------------- сеанс
  async login(officerId) {
    const { token, officer } = await api.login(officerId);
    const session = { token, officer };
    writeSession(session);
    set({ session });
  },
  logout() {
    writeSession(null);
    set({ session: null, ...initialData() });
  },

  // ---------------------------------------------------------------- завантаження
  async loadResource(key, call, apply) {
    set({ [`${key}Res`]: { status: 'loading', error: null } });
    try {
      const data = await call();
      set({ ...apply(data), [`${key}Res`]: { status: 'ready', error: null } });
    } catch (e) {
      set({ [`${key}Res`]: { status: 'error', error: toMessage(e) } });
    }
  },
  loadTracks: () =>
    get().loadResource('tracks', api.tracks, (d) => ({ tracks: Object.fromEntries(d.tracks.map((t) => [t.id, t])) })),
  loadEvents: () => get().loadResource('events', api.events, (d) => ({ events: d.events })),
  loadSources: () => get().loadResource('sources', api.sources, (d) => ({ sources: d.sources })),
  loadZones: () => get().loadResource('zones', api.zones, (d) => ({ zones: d.zones })),
  loadAll() {
    const s = get();
    return Promise.all([s.loadTracks(), s.loadEvents(), s.loadSources(), s.loadZones()]);
  },

  // ---------------------------------------------------------------- потік оновлень
  setConn: (conn) => set({ conn }),
  applyMessage(msg) {
    const now = Date.now();
    switch (msg.type) {
      case 'track.batch': {
        const tracks = { ...get().tracks };
        for (const t of msg.tracks) tracks[t.id] = { ...tracks[t.id], ...t };
        set({ tracks, lastMessageAt: now });
        break;
      }
      case 'event.new':
        set({ events: [msg.event, ...get().events.filter((e) => e.id !== msg.event.id)], lastMessageAt: now });
        break;
      case 'event.update':
        set({ events: get().events.map((e) => (e.id === msg.event.id ? msg.event : e)), lastMessageAt: now });
        break;
      case 'source.batch':
        set({ sources: msg.sources, lastMessageAt: now });
        break;
      case 'source.update':
        set({
          sources: get().sources.map((s) => (s.id === msg.source.id ? msg.source : s)),
          lastMessageAt: now,
        });
        break;
      default:
        set({ lastMessageAt: now });
    }
  },

  // ---------------------------------------------------------------- вибір і дії
  selectTrack: (id) => set({ selectedTrackId: id }),
  selectEvent(id) {
    const ev = get().events.find((e) => e.id === id);
    set({ selectedEventId: id, selectedTrackId: ev?.trackId ?? get().selectedTrackId });
  },
  toggleLayer: (domain) => set({ layers: { ...get().layers, [domain]: !get().layers[domain] } }),

  /** action: 'ack' — взяти в роботу, 'close' — закрити. Відповідь сервера оновлює подію; помилку кидаємо вгору. */
  async resolveEvent(id, action, comment) {
    const { event } = await api.resolveEvent(id, action, comment);
    set({ events: get().events.map((e) => (e.id === id ? event : e)) });
    return event;
  },
}));

configureApi({
  getToken: () => useStore.getState().session?.token ?? null,
  onUnauthorized: () => useStore.getState().logout(),
});
