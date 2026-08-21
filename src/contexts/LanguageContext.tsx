import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Language, translations, TranslationPath, interpolate } from '../lib/i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (path: TranslationPath, params?: Record<string, string | number>) => string;
  formatDateTime: (isoString: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'votica_lang';

/**
 * Detect browser language:
 * - Checks the primary (most preferred) browser language (e.g. navigator.languages[0] or navigator.language)
 * - If it starts with 'ja' (e.g. 'ja', 'ja-JP'), returns 'ja'
 * - Otherwise (e.g. 'en', 'en-US', 'zh', 'ko', 'fr', etc.), returns 'en'
 */
export function detectBrowserLanguage(
  customLanguages?: readonly string[],
  savedLang?: string | null
): Language {
  // 1. Check saved language preference first (explicit user selection)
  if (savedLang === 'ja' || savedLang === 'en') {
    return savedLang;
  }

  if (typeof localStorage !== 'undefined' && !savedLang) {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'ja' || saved === 'en') {
        return saved;
      }
    } catch {}
  }

  // 2. Check primary browser language (highest priority preference)
  const primaryLang =
    (customLanguages && customLanguages.length > 0 ? customLanguages[0] : undefined) ||
    (typeof navigator !== 'undefined'
      ? (navigator.languages && navigator.languages.length > 0
          ? navigator.languages[0]
          : navigator.language)
      : undefined) ||
    '';

  const lower = primaryLang.toLowerCase().trim();
  if (lower.startsWith('ja')) {
    return 'ja';
  }

  return 'en';
}

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => detectBrowserLanguage());

  const setLanguage = useCallback((newLang: Language) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
    } catch {}
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLang;
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'ja' ? 'en' : 'ja');
  }, [language, setLanguage]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = useCallback(
    (path: TranslationPath, params?: Record<string, string | number>): string => {
      const keys = path.split('.');
      let current: any = translations[language];

      for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key];
        } else {
          // Fallback to ja if key is missing in current language
          let fallback: any = translations.ja;
          for (const fbKey of keys) {
            if (fallback && typeof fallback === 'object' && fbKey in fallback) {
              fallback = fallback[fbKey];
            } else {
              fallback = path;
              break;
            }
          }
          current = fallback;
          break;
        }
      }

      if (typeof current === 'string') {
        return interpolate(current, params);
      }

      return path;
    },
    [language]
  );

  const formatDateTime = useCallback(
    (isoString: string): string => {
      if (!isoString) return '';
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');

      if (language === 'ja') {
        return `${y}/${m}/${day} ${h}:${min}`;
      } else {
        return `${m}/${day}/${y} ${h}:${min}`;
      }
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        formatDateTime,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const useTranslation = () => {
  const { t, language, setLanguage, toggleLanguage, formatDateTime } = useLanguage();
  return { t, language, setLanguage, toggleLanguage, formatDateTime };
};
