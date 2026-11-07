import { describe, it, expect, beforeEach } from 'vitest';
import { readStoredColorMode, resolveColorMode } from './ColorModeContext';

describe('color mode', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
      },
      configurable: true,
      writable: true,
    });
  });

  it('resolves system mode from the OS preference', () => {
    expect(resolveColorMode('system', true)).toBe('dark');
    expect(resolveColorMode('system', false)).toBe('light');
    expect(resolveColorMode('light', true)).toBe('light');
    expect(resolveColorMode('dark', false)).toBe('dark');
  });

  it('reads the stored preference and defaults to system', () => {
    expect(readStoredColorMode()).toBe('system');
    localStorage.setItem('votica_color_mode', 'dark');
    expect(readStoredColorMode()).toBe('dark');
    localStorage.setItem('votica_color_mode', 'bogus');
    expect(readStoredColorMode()).toBe('system');
  });
});
