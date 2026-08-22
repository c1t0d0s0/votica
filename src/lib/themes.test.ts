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
