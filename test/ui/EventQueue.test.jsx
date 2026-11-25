import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventQueue } from '../../src/components/EventQueue.jsx';

const NOW = Date.parse('2026-11-17T10:00:00Z');
const ev = (id, priority, minAgo, status = 'new') => ({
  id,
  priority,
  status,
  title: `Подія ${id}`,
  type: 'zone_entry',
  ts: new Date(NOW - minAgo * 60_000).toISOString(),
  ackBy: null,
  comment: '',
});

const setup = (events, props = {}) => {
  const onSelect = vi.fn();
  const onResolve = vi.fn();
  render(<EventQueue events={events} status="ready" now={NOW} selectedId={null} onSelect={onSelect} onResolve={onResolve} {...props} />);
  return { onSelect, onResolve };
};

describe('EventQueue', () => {
  it('сортує: прострочені вище, далі за пріоритетом (В-2)', () => {
    setup([ev('fresh-crit', 'critical', 1), ev('late-low', 'low', 90), ev('high', 'high', 2)]);
    const ids = screen.getAllByRole('option').map((o) => o.dataset.id);
    expect(ids).toEqual(['late-low', 'fresh-crit', 'high']);
  });

  it('позначає прострочену подію текстом, а не лише кольором (В-12)', () => {
    setup([ev('late', 'critical', 10)]);
    const item = screen.getByRole('option');
    expect(within(item).getByText('Прострочена')).toBeInTheDocument();
    expect(within(item).getByText(/прострочено 8 хв/)).toBeInTheDocument();
  });

  it('показує залишок часу до кінця SLA для непростроченої події', () => {
    setup([ev('a', 'critical', 1)]);
    expect(screen.getByTestId('sla-a')).toHaveTextContent('до кінця реагування 1 хв 00 с');
  });

  it('не показує закриті події', () => {
    setup([ev('open', 'low', 1), ev('done', 'low', 1, 'closed')]);
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('керується з клавіатури: стрілки обирають, A бере в роботу, C закриває (В-12)', async () => {
    const events = [ev('a', 'critical', 1), ev('b', 'high', 1)];
    const onSelect = vi.fn();
    const onResolve = vi.fn();
    const { rerender } = render(<EventQueue events={events} status="ready" now={NOW} selectedId={null} onSelect={onSelect} onResolve={onResolve} />);
    screen.getByRole('listbox').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onSelect).toHaveBeenLastCalledWith('a');

    rerender(<EventQueue events={events} status="ready" now={NOW} selectedId="a" onSelect={onSelect} onResolve={onResolve} />);
    screen.getByRole('listbox').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onSelect).toHaveBeenLastCalledWith('b');
    await userEvent.keyboard('a');
    expect(onResolve).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'a' }), 'ack');
    await userEvent.keyboard('c');
    expect(onResolve).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'a' }), 'close');
  });

  it('стрілка вгору не виходить за межі черги', async () => {
    const { onSelect } = setup([ev('a', 'critical', 1)], { selectedId: 'a' });
    screen.getByRole('listbox').focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(onSelect).toHaveBeenLastCalledWith('a');
  });

  it('кнопки дій з’являються лише в обраної події', async () => {
    setup([ev('a', 'low', 1), ev('b', 'low', 2)], { selectedId: 'a' });
    expect(screen.getAllByRole('button', { name: 'Взяти в роботу' })).toHaveLength(1);
  });

  it('стан порожньої черги', () => {
    setup([]);
    expect(screen.getByText('Незакритих подій немає')).toBeInTheDocument();
  });

  it('стан помилки з повторенням', async () => {
    const onRetry = vi.fn();
    setup([], { status: 'error', error: 'Тестовий збій', onRetry });
    await userEvent.click(screen.getByRole('button', { name: 'Повторити' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('стан завантаження', () => {
    setup([], { status: 'loading' });
    expect(screen.getByTestId('state-loading')).toBeInTheDocument();
  });
});
