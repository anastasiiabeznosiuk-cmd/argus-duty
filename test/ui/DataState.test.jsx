import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataState } from '../../src/ui/DataState.jsx';

const data = <p>Дані на місці</p>;

describe('DataState: чотири стани представлення', () => {
  it('стан завантаження: показує скелетон і не показує дані', () => {
    render(<DataState status="loading" isEmpty>{data}</DataState>);
    expect(screen.getByTestId('state-loading')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Дані на місці')).not.toBeInTheDocument();
  });

  it('стан помилки: показує повідомлення і кнопку «Повторити»', async () => {
    const retry = vi.fn();
    render(<DataState status="error" error="Тестовий збій сервера" onRetry={retry}>{data}</DataState>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Тестовий збій сервера')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторити' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('стан відсутності даних: показує пояснення, що робити далі', () => {
    render(<DataState status="ready" isEmpty emptyTitle="Журнал порожній" emptyText="Подій ще не було.">{data}</DataState>);
    expect(screen.getByTestId('state-empty')).toBeInTheDocument();
    expect(screen.getByText('Журнал порожній')).toBeInTheDocument();
    expect(screen.getByText('Подій ще не було.')).toBeInTheDocument();
  });

  it('стан даних: показує вміст', () => {
    render(<DataState status="ready" isEmpty={false}>{data}</DataState>);
    expect(screen.getByText('Дані на місці')).toBeInTheDocument();
  });

  it('повторне завантаження не ховає вже наявні дані', () => {
    render(<DataState status="loading" isEmpty={false}>{data}</DataState>);
    expect(screen.getByText('Дані на місці')).toBeInTheDocument();
  });
});
