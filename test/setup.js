import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom не реалізує деякі API, потрібні Carbon і картам.
if (typeof window !== 'undefined') {
  window.matchMedia ??= (query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.HTMLElement.prototype.scrollIntoView ??= () => {};
  window.requestAnimationFrame ??= (cb) => setTimeout(cb, 0);
}

afterEach(() => cleanup());
