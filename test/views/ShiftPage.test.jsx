import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  api: { shift: vi.fn(), accept: vi.fn(), handover: vi.fn() },
}));

import { api } from '../../src/api.js';
import { useStore } from '../../src/store.js';
import { ShiftPage } from '../../src/views/ShiftPage.jsx';

const NOW = Date.now();
const iso = (minAgo) => new Date(NOW - minAgo * 60_000).toISOString();
const officer = { id: 'o-2', name: 'Мельник Т. В.', rank: 'капітан' };

const events = [
  { id: 'E-1', priority: 'critical', status: 'new', title: 'Критична подія', ts: iso(5) },
  { id: 'E-2', priority: 'low', status: 'acked', title: 'Низька подія', ts: iso(30) },
  { id: 'E-3', priority: 'low', status: 'closed', title: 'Закрита подія', ts: iso(90) },
];
const sources = [
  { id: 's1', name: 'AIS-приймач', health: 'ok' },
  { id: 's2', name: 'РЛС-2', health: 'down' },
];
const counts = { open: 2, new: 1, overdue: 1, critical: 1 };
const report = {
  id: 'R-001',
  from: { id: 'o-1', name: 'Коваль О. І.', rank: 'майор' },
  createdAt: iso(4),
  notes: 'Стежити за рейдом',
  openEventIds: ['E-1', 'E-2', 'E-3'],
  counts,
  sourcesSnapshot: sources,
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/shift']}>
      <ShiftPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useStore.setState({ session: { token: 't', officer }, events, sources });
});

describe('ShiftPage: приймання (В-8)', () => {
  beforeEach(() => {
    api.shift.mockResolvedValue({ active: null, pendingHandover: report, history: [] });
  });

  it('показує звіт, примітки та лише незакриті події', async () => {
    renderPage();
    expect(await screen.findByText('Приймання зміни')).toBeInTheDocument();
    expect(screen.getByText('Стежити за рейдом')).toBeInTheDocument();
    expect(screen.getByText('Критична подія')).toBeInTheDocument();
    expect(screen.getByText('Низька подія')).toBeInTheDocument();
    expect(screen.queryByText('Закрита подія')).not.toBeInTheDocument();
  });

  it('блокує приймання, доки не переглянуто всі події', async () => {
    renderPage();
    const accept = await screen.findByRole('button', { name: 'Прийняти зміну' });
    expect(accept).toBeDisabled();
    expect(screen.getByText('Залишилось переглянути: 2')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Ознайомлений: E-1'));
    expect(accept).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Ознайомлений: E-2'));
    expect(accept).toBeEnabled();
  });

  it('надсилає перелік переглянутих подій', async () => {
    api.accept.mockResolvedValue({});
    renderPage();
    await userEvent.click(await screen.findByLabelText('Ознайомлений: E-1'));
    await userEvent.click(screen.getByLabelText('Ознайомлений: E-2'));
    await userEvent.click(screen.getByRole('button', { name: 'Прийняти зміну' }));
    await waitFor(() => expect(api.accept).toHaveBeenCalledWith('R-001', expect.arrayContaining(['E-1', 'E-2'])));
  });

  it('показує помилку сервера під час приймання', async () => {
    api.accept.mockRejectedValue(new Error('Не переглянуто всі незакриті події'));
    renderPage();
    await userEvent.click(await screen.findByLabelText('Ознайомлений: E-1'));
    await userEvent.click(screen.getByLabelText('Ознайомлений: E-2'));
    await userEvent.click(screen.getByRole('button', { name: 'Прийняти зміну' }));
    expect(await screen.findByText('Не переглянуто всі незакриті події')).toBeInTheDocument();
  });
});

describe('ShiftPage: передавання (В-9)', () => {
  beforeEach(() => {
    api.shift.mockResolvedValue({
      active: { officerId: 'o-2', name: officer.name, rank: officer.rank, startedAt: iso(120) },
      pendingHandover: null,
      history: [],
    });
  });

  it('формує звіт автоматично: події, прострочення, джерела', async () => {
    renderPage();
    expect(await screen.findByText('Передавання зміни')).toBeInTheDocument();
    expect(screen.getByText('Критична подія')).toBeInTheDocument();
    expect(screen.getByText('Прострочена')).toBeInTheDocument();
    expect(screen.getByText('РЛС-2')).toBeInTheDocument();
    expect(screen.getByText(/Нікому не передано подій: 1/)).toBeInTheDocument();
  });

  it('зберігає чернетку приміток між перезавантаженнями', async () => {
    const first = renderPage();
    await userEvent.type(await screen.findByLabelText(/Примітки наступній зміні/), 'Увага на рейд');
    expect(localStorage.getItem('argus.notes.o-2')).toBe('Увага на рейд');
    first.unmount();
    renderPage();
    expect(await screen.findByLabelText(/Примітки наступній зміні/)).toHaveValue('Увага на рейд');
  });

  it('передає зміну з приміткою після підтвердження', async () => {
    api.handover.mockResolvedValue({});
    renderPage();
    await userEvent.type(await screen.findByLabelText(/Примітки наступній зміні/), 'Усе спокійно');
    await userEvent.click(screen.getByRole('button', { name: 'Передати зміну' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Передати' }));
    await waitFor(() => expect(api.handover).toHaveBeenCalledWith('Усе спокійно'));
    expect(await screen.findByTestId('handover-done')).toBeInTheDocument();
  });
});

describe('ShiftPage: інші стани', () => {
  it('стан помилки з повторенням запиту', async () => {
    api.shift.mockRejectedValueOnce(new Error('Немає зв’язку із сервером')).mockResolvedValueOnce({
      active: { officerId: 'o-9', name: 'Інший Ч. Ч.', rank: 'майор', startedAt: iso(10) },
      pendingHandover: null,
      history: [],
    });
    renderPage();
    expect(await screen.findByText('Немає зв’язку із сервером')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторити' }));
    expect(await screen.findByText('Зміну веде Інший Ч. Ч.')).toBeInTheDocument();
  });

  it('стан завантаження до відповіді сервера', () => {
    api.shift.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('state-loading')).toBeInTheDocument();
  });
});
