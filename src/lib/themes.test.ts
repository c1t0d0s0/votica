import { describe, it, expect } from 'vitest';
import {
  THEMES,
  THEME_CATEGORIES,
  getTheme,
  getAllThemes,
  getThemesByCategory,
} from './themes';

describe('Theme System', () => {
  it('has at least 20 themes defined in THEMES record', () => {
    expect(Object.keys(THEMES).length).toBeGreaterThanOrEqual(20);
    const allThemes = getAllThemes();
    expect(allThemes.length).toBeGreaterThanOrEqual(20);
    expect(allThemes.length).toBe(22);
  });

  it('includes the default classic indigo theme', () => {
    const defaultTheme = getTheme('default');
    expect(defaultTheme).toBeDefined();
    expect(defaultTheme.id).toBe('default');
    expect(defaultTheme.isDark).toBe(false);
    expect(defaultTheme.previewColors.length).toBe(3);
    expect(defaultTheme.classes.primaryBtn).toContain('indigo');
  });

  it('safely falls back to default theme for unknown or empty IDs', () => {
    expect(getTheme(undefined).id).toBe('default');
    expect(getTheme('').id).toBe('default');
    expect(getTheme('non-existent-theme-xyz').id).toBe('default');
  });

  it('has valid structure and required CSS classes for all themes', () => {
    const allThemes = getAllThemes();
    for (const theme of allThemes) {
      expect(theme.id).toBeTruthy();
      expect(theme.nameKey).toBeTruthy();
      expect(theme.fallbackName).toBeTruthy();
      expect(theme.emoji).toBeTruthy();
      expect(theme.previewColors).toHaveLength(3);
      expect(theme.classes).toBeDefined();
      expect(theme.classes.pageBg).toBeTruthy();
      expect(theme.classes.cardBg).toBeTruthy();
      expect(theme.classes.primaryBtn).toBeTruthy();
      expect(theme.classes.accentBadge).toBeTruthy();
      expect(theme.classes.selectedOption).toBeTruthy();
      expect(theme.classes.titleText).toBeTruthy();
    }
  });

  it('correctly filters themes by category', () => {
    const simpleThemes = getThemesByCategory('simple');
    expect(simpleThemes.length).toBe(4);
    expect(simpleThemes.every(t => t.category === 'simple')).toBe(true);

    const businessThemes = getThemesByCategory('business');
    expect(businessThemes.length).toBe(4);
    expect(businessThemes.every(t => t.category === 'business')).toBe(true);

    const coolThemes = getThemesByCategory('cool');
    expect(coolThemes.length).toBe(4);
    expect(coolThemes.every(t => t.category === 'cool')).toBe(true);

    const cuteThemes = getThemesByCategory('cute');
    expect(cuteThemes.length).toBe(5);
    expect(cuteThemes.every(t => t.category === 'cute')).toBe(true);

    const naturalThemes = getThemesByCategory('natural');
    expect(naturalThemes.length).toBe(5);
    expect(naturalThemes.every(t => t.category === 'natural')).toBe(true);

    const allThemes = getThemesByCategory('all');
    expect(allThemes.length).toBe(22);
  });

  it('has valid theme category definitions', () => {
    expect(THEME_CATEGORIES.length).toBe(6);
    const categoryIds = THEME_CATEGORIES.map(c => c.id);
    expect(categoryIds).toContain('all');
    expect(categoryIds).toContain('simple');
    expect(categoryIds).toContain('business');
    expect(categoryIds).toContain('cool');
    expect(categoryIds).toContain('cute');
    expect(categoryIds).toContain('natural');
  });

  it('correctly identifies dark mode themes', () => {
    const midnight = getTheme('midnight-black');
    expect(midnight.isDark).toBe(true);

    const cyber = getTheme('cyber-neon');
    expect(cyber.isDark).toBe(true);

    const deepSpace = getTheme('deep-space');
    expect(deepSpace.isDark).toBe(true);

    const classic = getTheme('default');
    expect(classic.isDark).toBe(false);

    const sakura = getTheme('sakura-pink');
    expect(sakura.isDark).toBe(false);
  });
});

describe('dark theme palette mirroring', () => {
  it('mirrors palette shades including variants and opacity', async () => {
    const { mirrorColorClasses } = await import('./themes');
    expect(mirrorColorClasses('bg-slate-900 hover:text-cyan-300 border-slate-800/50 text-white bg-[#0d1527] p-4')).toBe(
      'bg-slate-100 hover:text-cyan-700 border-slate-200/50 text-white bg-[#0d1527] p-4'
    );
    // chromatic 400-600 are kept, neutral 400/600 swap
    expect(mirrorColorClasses('bg-indigo-600 text-slate-400 text-slate-500')).toBe('bg-indigo-600 text-slate-600 text-slate-500');
  });

  it('is an involution (mirroring twice restores the original)', async () => {
    const { mirrorColorClasses, getAllThemes } = await import('./themes');
    for (const theme of getAllThemes()) {
      for (const value of Object.values(theme.classes)) {
        expect(mirrorColorClasses(mirrorColorClasses(value))).toBe(value);
      }
    }
  });

  it('returns a palette-dark scope with surface color only for dark themes', async () => {
    const { getDisplayTheme, getAllThemes } = await import('./themes');
    expect(getDisplayTheme('default').scopeClass).toBe('');
    const dark = getAllThemes().filter(t => t.isDark);
    expect(dark.length).toBeGreaterThan(0);
    for (const t of dark) {
      const display = getDisplayTheme(t.id);
      expect(display.scopeClass).toBe('palette-dark');
      const hasHexCard = /bg-\[#/.test(t.classes.cardBg);
      if (hasHexCard) expect(display.scopeStyle['--surface']).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      else expect(display.scopeStyle['--surface']).toBeUndefined();
    }
  });

  it('safelists every mirrored dark-theme class for Tailwind (run npm run gen:dark-palette if this fails)', async () => {
    const { getDisplayTheme, getAllThemes, getTheme } = await import('./themes');
    const { DARK_THEME_SAFELIST } = await import('./darkThemeSafelist.generated');
    const safelisted = new Set(DARK_THEME_SAFELIST);
    for (const t of getAllThemes().filter(th => th.isDark)) {
      const original = Object.values(getTheme(t.id).classes).join(' ').split(/\s+/);
      const mirrored = Object.values(getDisplayTheme(t.id).classes).join(' ').split(/\s+/);
      mirrored.forEach((token, i) => {
        if (token !== original[i]) expect(safelisted.has(token), token).toBe(true);
      });
    }
  });
});

