import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/api.js', async (orig) => ({
  ...(await orig()),
  api: { tracks: vi.fn(), events: vi.fn(), resolveEvent: vi.fn(), login: vi.fn() },
}));

import { api } from '../src/api.js';
import { useStore } from '../src/store.js';

const track = (id, lat) => ({ id, name: id, lat, lon: 30, domain: 'surface' });

beforeEach(() => {
  vi.clearAllMocks();
  useStore.getState().logout();
});

describe('сховище стану', () => {
  it('об’єднує пакет оновлень цілей із наявними даними', () => {
    useStore.setState({ tracks: { a: { ...track('a', 46), kindLabel: 'Танкер' } } });
    useStore.getState().applyMessage({ type: 'track.batch', tracks: [track('a', 47), track('b', 45)] });
    const { tracks } = useStore.getState();
    expect(tracks.a.lat).toBe(47);
    expect(tracks.a.kindLabel).toBe('Танкер');
    expect(tracks.b.lat).toBe(45);
  });

  it('додає нову подію на початок і не дублює повторну', () => {
    const ev = { id: 'E-1', status: 'new' };
    useStore.getState().applyMessage({ type: 'event.new', event: ev });
    useStore.getState().applyMessage({ type: 'event.new', event: ev });
    expect(useStore.getState().events).toHaveLength(1);
  });

  it('оновлює статус події за повідомленням event.update', () => {
    useStore.setState({ events: [{ id: 'E-1', status: 'new' }, { id: 'E-2', status: 'new' }] });
    useStore.getState().applyMessage({ type: 'event.update', event: { id: 'E-1', status: 'closed' } });
    expect(useStore.getState().events.map((e) => e.status)).toEqual(['closed', 'new']);
  });

  it('вибір події одночасно вибирає її ціль', () => {
    useStore.setState({ events: [{ id: 'E-1', trackId: 'T-5' }] });
    useStore.getState().selectEvent('E-1');
    expect(useStore.getState().selectedTrackId).toBe('T-5');
    expect(useStore.getState().selectedEventId).toBe('E-1');
  });

  it('завантаження: loading → ready з даними', async () => {
    api.events.mockResolvedValue({ events: [{ id: 'E-1' }] });
    const p = useStore.getState().loadEvents();
    expect(useStore.getState().eventsRes.status).toBe('loading');
    await p;
    expect(useStore.getState().eventsRes.status).toBe('ready');
    expect(useStore.getState().events).toHaveLength(1);
  });

  it('завантаження: помилка зберігається, наявні дані не втрачаються', async () => {
    useStore.setState({ events: [{ id: 'E-1' }] });
    api.events.mockRejectedValue(new Error('Немає зв’язку із сервером'));
    await useStore.getState().loadEvents();
    expect(useStore.getState().eventsRes).toEqual({ status: 'error', error: 'Немає зв’язку із сервером' });
    expect(useStore.getState().events).toHaveLength(1);
  });

  it('вихід очищає сеанс і дані', () => {
    useStore.setState({ session: { token: 't' }, events: [{ id: 'E-1' }], selectedTrackId: 'T-1' });
    useStore.getState().logout();
    const s = useStore.getState();
    expect(s.session).toBeNull();
    expect(s.events).toEqual([]);
    expect(s.selectedTrackId).toBeNull();
  });

  it('вхід зберігає токен у sessionStorage і переживає перезавантаження сторінки (В-13)', async () => {
    api.login.mockResolvedValue({ token: 'abc', officer: { id: 'o-1' } });
    await useStore.getState().login('o-1');
    expect(JSON.parse(sessionStorage.getItem('argus.session')).token).toBe('abc');
  });
});
