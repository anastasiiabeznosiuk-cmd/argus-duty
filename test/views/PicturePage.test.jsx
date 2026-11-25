import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// WebGL-карта не працює в jsdom: підставляємо заглушку, що показує, які цілі їй передано.
vi.mock('../../src/components/SituationMap.jsx', () => ({
  SituationMap: ({ tracks, layers, alertTrackIds, onSelectTrack }) => (
    <div data-testid="map-stub">
      {tracks
        .filter((t) => layers[t.domain])
        .map((t) => (
          <button key={t.id} data-alert={alertTrackIds.has(t.id)} onClick={() => onSelectTrack(t.id)}>
            {t.name}
          </button>
        ))}
    </div>
  ),
}));
vi.mock('../../src/api.js', async (orig) => ({ ...(await orig()), api: { resolveEvent: vi.fn() } }));

import { api } from '../../src/api.js';
import { useStore } from '../../src/store.js';
import { PicturePage } from '../../src/views/PicturePage.jsx';

const NOW = Date.now();
const iso = (m) => new Date(NOW - m * 60_000).toISOString();
const tracks = {
  'T-1': { id: 'T-1', name: 'MV-101', kindLabel: 'Вантажне судно', domain: 'surface', classification: 'neutral', lat: 46.4, lon: 31, cog: 90, sog: 10, sourceId: 's1', zones: [], ts: iso(0) },
  'T-2': { id: 'T-2', name: 'БП-300', kindLabel: 'БпЛА', domain: 'air', classification: 'unknown', lat: 46.5, lon: 30.9, cog: 10, sog: 60, alt: 300, sourceId: 's1', zones: [], ts: iso(0) },
};
const events = [
  { id: 'E-1', priority: 'critical', status: 'new', title: 'Критична подія', ts: iso(1), trackId: 'T-2', type: 'zone_entry' },
  { id: 'E-2', priority: 'low', status: 'new', title: 'Низька подія', ts: iso(1), trackId: 'T-1', type: 'new_track' },
];
const ready = { status: 'ready', error: null };

const reset = (patch = {}) =>
  useStore.setState({
    session: { token: 't', officer: { id: 'o', name: 'Т', rank: 'к' } },
    tracks,
    events,
    sources: [{ id: 's1', name: 'AIS', type: 'ais', health: 'ok', lastMessageAt: NOW }],
    zones: [],
    tracksRes: ready,
    eventsRes: ready,
    sourcesRes: ready,
    zonesRes: ready,
    selectedTrackId: null,
    selectedEventId: null,
    layers: { surface: true, air: true },
    ...patch,
  });

const renderPage = () =>
  render(
    <MemoryRouter>
      <PicturePage />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  reset();
});

describe('PicturePage: зведена обстановка', () => {
  it('показує цілі обох доменів і лічильники шарів (В-1)', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'MV-101' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'БП-300' })).toBeInTheDocument();
    expect(screen.getByLabelText('Надводні (1)')).toBeChecked();
    expect(screen.getByLabelText('Повітряні (1)')).toBeChecked();
  });

  it('вимкнення шару ховає цілі домену', async () => {
    renderPage();
    await userEvent.click(screen.getByLabelText('Повітряні (1)'));
    expect(screen.queryByRole('button', { name: 'БП-300' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'MV-101' })).toBeInTheDocument();
  });

  it('позначає цілі з критичними та високими подіями (alert)', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'БП-300' })).toHaveAttribute('data-alert', 'true');
    expect(screen.getByRole('button', { name: 'MV-101' })).toHaveAttribute('data-alert', 'false');
  });

  it('вибір події відкриває картку цілі (В-5)', async () => {
    renderPage();
    await userEvent.click(screen.getByText('Критична подія'));
    expect(screen.getByRole('complementary', { name: 'Ціль БП-300' })).toBeInTheDocument();
    expect(screen.getByText('300 м')).toBeInTheDocument();
  });

  it('вибір цілі на карті відкриває картку з пов’язаними подіями', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'MV-101' }));
    const card = screen.getByRole('complementary', { name: 'Ціль MV-101' });
    expect(card).toHaveTextContent('Низька подія');
  });

  it('підтвердження критичної події з коментарем оновлює чергу (В-4)', async () => {
    api.resolveEvent.mockResolvedValue({ event: { ...events[0], status: 'acked', ackBy: 'Т', comment: 'Взято' } });
    renderPage();
    await userEvent.click(screen.getByText('Критична подія'));
    await userEvent.click(screen.getByRole('button', { name: 'Взяти в роботу' }));
    await userEvent.type(screen.getByLabelText(/Коментар/), 'Взято');
    await userEvent.click(screen.getAllByRole('button', { name: 'Взяти в роботу' }).at(-1));
    expect(api.resolveEvent).toHaveBeenCalledWith('E-1', 'ack', 'Взято');
    expect(await screen.findByText(/Взяв у роботу: Т/)).toBeInTheDocument();
  });
});

describe('PicturePage: стани (В-11)', () => {
  it('завантаження', () => {
    reset({ tracks: {}, events: [], tracksRes: { status: 'loading', error: null }, eventsRes: { status: 'loading', error: null } });
    renderPage();
    expect(screen.getAllByTestId('state-loading').length).toBeGreaterThanOrEqual(2);
  });

  it('помилка карти не ламає чергу подій', () => {
    reset({ tracks: {}, tracksRes: { status: 'error', error: 'Тестовий збій сервера' } });
    renderPage();
    expect(screen.getByText('Тестовий збій сервера')).toBeInTheDocument();
    expect(screen.getByText('Критична подія')).toBeInTheDocument();
  });

  it('відсутність цілей і подій', () => {
    reset({ tracks: {}, events: [] });
    renderPage();
    expect(screen.getByText('Цілей у районі немає')).toBeInTheDocument();
    expect(screen.getByText('Незакритих подій немає')).toBeInTheDocument();
  });
});
