import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

export type ColorMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'votica_color_mode';
const THEME_COLOR_LIGHT = '#4f46e5';
const THEME_COLOR_DARK = '#020617';

interface ColorModeContextType {
  /** User preference */
  mode: ColorMode;
  /** Actually applied mode */
  resolved: 'light' | 'dark';
  setMode: (mode: ColorMode) => void;
  /** light -> dark -> system -> light */
  cycleMode: () => void;
}

const ColorModeContext = createContext<ColorModeContextType | undefined>(undefined);

export function readStoredColorMode(): ColorMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

const prefersDark = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;

export function resolveColorMode(mode: ColorMode, systemDark: boolean): 'light' | 'dark' {
  return mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
}

function applyToDocument(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
}

export const ColorModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ColorMode>(readStoredColorMode);
  const [systemDark, setSystemDark] = useState<boolean>(prefersDark);

  // Follow OS changes while in "system" mode
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const resolved = resolveColorMode(mode, systemDark);

  useEffect(() => {
    applyToDocument(resolved);
  }, [resolved]);

  const setMode = useCallback((next: ColorMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);

  const cycleMode = useCallback(() => {
    setMode(mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light');
  }, [mode, setMode]);

  return (
    <ColorModeContext.Provider value={{ mode, resolved, setMode, cycleMode }}>{children}</ColorModeContext.Provider>
  );
};

export function useColorMode(): ColorModeContextType {
  const ctx = useContext(ColorModeContext);
  if (!ctx) throw new Error('useColorMode must be used within ColorModeProvider');
  return ctx;
}
