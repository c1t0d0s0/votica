import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { detectBrowserLanguage } from '../contexts/LanguageContext';
import { interpolate, translations } from './i18n/translations';

describe('i18n language detection and translations', () => {
  const originalNavigator = globalThis.navigator;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    // Clear localStorage mockup
    const store: Record<string, string> = {};
    const mockLocalStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('detects Japanese when browser language is ja-JP', () => {
    expect(detectBrowserLanguage(['ja-JP', 'ja', 'en-US'])).toBe('ja');
  });

  it('detects Japanese when browser language is ja', () => {
    expect(detectBrowserLanguage(['ja'])).toBe('ja');
  });

  it('detects English when browser language is en-US', () => {
    expect(detectBrowserLanguage(['en-US', 'en'])).toBe('en');
  });

  it('detects English when browser primary language is English even if Japanese is in secondary preferences', () => {
    // Typical scenario on English browser or OS in Japan (e.g. ['en-US', 'en', 'ja'])
    expect(detectBrowserLanguage(['en-US', 'en', 'ja'])).toBe('en');
    expect(detectBrowserLanguage(['en', 'ja-JP'])).toBe('en');
  });

  it('detects English for non-Japanese languages (zh-CN, ko-KR, fr-FR, de, etc.)', () => {
    const nonJaLanguages = [
      ['zh-CN', 'zh'],
      ['ko-KR', 'ko'],
      ['fr-FR', 'fr'],
      ['de-DE', 'de'],
      ['es-ES', 'es'],
      ['pt-BR', 'pt'],
    ];

    for (const langs of nonJaLanguages) {
      expect(detectBrowserLanguage(langs)).toBe('en');
    }
  });

  it('honors saved user preference in localStorage over browser language', () => {
    localStorage.setItem('votica_lang', 'en');
    expect(detectBrowserLanguage(['ja-JP', 'ja'])).toBe('en');

    localStorage.setItem('votica_lang', 'ja');
    expect(detectBrowserLanguage(['en-US', 'en'])).toBe('ja');
  });

  it('interpolates parameters accurately in strings', () => {
    const template = 'Hello {{name}}, you have {{count}} votes.';
    const result = interpolate(template, { name: 'Alice', count: 42 });
    expect(result).toBe('Hello Alice, you have 42 votes.');
  });

  it('contains complete Japanese and English translation keys matching dictionary', () => {
    expect(translations.ja.header.createNewPoll).toBe('新しい投票を作成');
    expect(translations.en.header.createNewPoll).toBe('Create New Poll');

    expect(translations.ja.header.createPoll).toBe('投票を作成');
    expect(translations.en.header.createPoll).toBe('Create Poll');

    expect(translations.ja.common.vote).toBe('投票する');
    expect(translations.en.common.vote).toBe('Vote');

    expect(translations.ja.home.heroTitle).toContain('少数意見も埋もれない');
    expect(translations.en.home.heroTitle).toContain('Fair Decisions');
  });
});
