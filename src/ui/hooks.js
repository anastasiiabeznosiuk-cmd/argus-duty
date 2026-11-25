import { useEffect, useState } from 'react';

/** Поточний час, що оновлюється щосекунди: від нього залежать таймери SLA і прострочення. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Чернетка в localStorage (примітки до передавання зміни); якщо сховище недоступне — працює в пам’яті. */
export function useDraft(key, initial = '') {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });
  const update = (next) => {
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      /* ігноруємо */
    }
  };
  const clear = () => {
    setValue(initial);
    try {
      localStorage.removeItem(key);
    } catch {
      /* ігноруємо */
    }
  };
  return [value, update, clear];
}
