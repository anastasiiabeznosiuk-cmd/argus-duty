import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResolveDialog } from '../../src/components/ResolveDialog.jsx';

const event = (priority) => ({ id: 'E-1', priority, priorityLabel: priority, title: 'Тестова подія' });

describe('ResolveDialog (В-4)', () => {
  it('для критичної події кнопка заблокована, доки немає коментаря', async () => {
    render(<ResolveDialog event={event('critical')} action="ack" onClose={() => {}} onSubmit={async () => {}} />);
    const submit = screen.getByRole('button', { name: 'Взяти в роботу' });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Коментар/), 'Екіпаж на виході');
    expect(submit).toBeEnabled();
  });

  it('для некритичної події коментар необов’язковий', () => {
    render(<ResolveDialog event={event('low')} action="close" onClose={() => {}} onSubmit={async () => {}} />);
    expect(screen.getByRole('button', { name: 'Закрити подію' })).toBeEnabled();
  });

  it('передає обрізаний коментар і закривається після успіху', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    const onClose = vi.fn();
    render(<ResolveDialog event={event('high')} action="ack" onClose={onClose} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/Коментар/), '  Перевірено  ');
    await userEvent.click(screen.getByRole('button', { name: 'Взяти в роботу' }));
    expect(onSubmit).toHaveBeenCalledWith('Перевірено');
    expect(onClose).toHaveBeenCalled();
  });

  it('показує помилку сервера і не закривається', async () => {
    const onClose = vi.fn();
    render(<ResolveDialog event={event('low')} action="ack" onClose={onClose} onSubmit={async () => Promise.reject(new Error('Подію вже закрито'))} />);
    await userEvent.click(screen.getByRole('button', { name: 'Взяти в роботу' }));
    expect(await screen.findByText('Подію вже закрито')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
