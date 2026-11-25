// Потік оновлень WebSocket: підключення, повторні спроби з наростаючою затримкою, виявлення «німого» каналу.
import { useStore } from './store.js';

const STALE_AFTER_MS = 8000;
let socket = null;
let retryTimer = null;
let watchdog = null;
let attempt = 0;
let wanted = false;

const wsUrl = (token) => {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`;
};

function open() {
  const token = useStore.getState().session?.token;
  if (!wanted || !token) return;
  useStore.getState().setConn('connecting');
  socket = new WebSocket(wsUrl(token));
  socket.onopen = () => {
    const reconnect = attempt > 0;
    attempt = 0;
    useStore.getState().setConn('open');
    // після розриву дані могли змінитися — синхронізуємо зі знімком сервера
    if (reconnect) useStore.getState().loadAll();
  };
  socket.onmessage = (e) => {
    try {
      useStore.getState().applyMessage(JSON.parse(e.data));
      if (useStore.getState().conn !== 'open') useStore.getState().setConn('open');
    } catch {
      /* пошкоджене повідомлення ігноруємо */
    }
  };
  socket.onclose = () => {
    socket = null;
    if (!wanted) return;
    useStore.getState().setConn('closed');
    const delay = Math.min(10_000, 1000 * 2 ** attempt++);
    retryTimer = setTimeout(open, delay);
  };
  socket.onerror = () => socket?.close();
}

export function connectLine() {
  if (wanted) return;
  wanted = true;
  attempt = 0;
  open();
  watchdog = setInterval(() => {
    const { conn, lastMessageAt } = useStore.getState();
    if (conn === 'open' && lastMessageAt && Date.now() - lastMessageAt > STALE_AFTER_MS) {
      useStore.getState().setConn('stale');
    }
  }, 2000);
}

export function disconnectLine() {
  wanted = false;
  clearTimeout(retryTimer);
  clearInterval(watchdog);
  socket?.close();
  socket = null;
  useStore.getState().setConn('closed');
}
