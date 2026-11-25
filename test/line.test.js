import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/api.js', async (orig) => ({
  ...(await orig()),
  api: { tracks: vi.fn().mockResolvedValue({ tracks: [] }), events: vi.fn().mockResolvedValue({ events: [] }), sources: vi.fn().mockResolvedValue({ sources: [] }), zones: vi.fn().mockResolvedValue({ zones: [] }) },
}));

import { api } from '../src/api.js';
import { useStore } from '../src/store.js';
import { connectLine, disconnectLine } from '../src/line.js';

class FakeSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.closed = false;
    FakeSocket.instances.push(this);
  }
  close() {
    this.closed = true;
    this.onclose?.();
  }
}
const last = () => FakeSocket.instances.at(-1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  useStore.setState({ session: { token: 'tok', officer: { id: 'o' } }, conn: 'closed', lastMessageAt: 0, tracks: {} });
});
afterEach(() => {
  disconnectLine();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('line.js: канал оновлень (В-10)', () => {
  it('підключається з токеном і переходить у стан «open»', () => {
    connectLine();
    expect(useStore.getState().conn).toBe('connecting');
    expect(last().url).toContain('/ws?token=tok');
    last().onopen();
    expect(useStore.getState().conn).toBe('open');
  });

  it('передає повідомлення у сховище', () => {
    connectLine();
    last().onopen();
    last().onmessage({ data: JSON.stringify({ type: 'track.batch', tracks: [{ id: 'T-1', lat: 46, lon: 30 }] }) });
    expect(useStore.getState().tracks['T-1'].lat).toBe(46);
  });

  it('ігнорує пошкоджене повідомлення', () => {
    connectLine();
    last().onopen();
    expect(() => last().onmessage({ data: '{не json' })).not.toThrow();
  });

  it('після розриву перепідключається з наростаючою затримкою 1 с, 2 с, 4 с', () => {
    connectLine();
    last().onopen();
    last().onclose();
    expect(useStore.getState().conn).toBe('closed');
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances).toHaveLength(2);
    last().onclose();
    vi.advanceTimersByTime(1999);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(3);
    last().onclose();
    vi.advanceTimersByTime(4000);
    expect(FakeSocket.instances).toHaveLength(4);
  });

  it('після відновлення зв’язку заново завантажує знімок обстановки', () => {
    connectLine();
    last().onopen();
    expect(api.events).not.toHaveBeenCalled();
    last().onclose();
    vi.advanceTimersByTime(1000);
    last().onopen();
    expect(api.events).toHaveBeenCalledTimes(1);
    expect(api.tracks).toHaveBeenCalledTimes(1);
  });

  it('позначає канал «застарілим», якщо повідомлень немає понад 8 с', () => {
    connectLine();
    last().onopen();
    last().onmessage({ data: JSON.stringify({ type: 'hello' }) });
    expect(useStore.getState().conn).toBe('open');
    vi.advanceTimersByTime(12_000);
    expect(useStore.getState().conn).toBe('stale');
  });

  it('після disconnectLine не перепідключається', () => {
    connectLine();
    last().onopen();
    disconnectLine();
    vi.advanceTimersByTime(30_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(useStore.getState().conn).toBe('closed');
  });
});
