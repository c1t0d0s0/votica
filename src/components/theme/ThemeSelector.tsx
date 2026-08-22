import React, { useState } from 'react';
import {
  THEME_CATEGORIES,
  ThemeCategory,
  getTheme,
  getThemesByCategory,
} from '../../lib/themes';
import { useTranslation } from '../../contexts/LanguageContext';
import { Check, Sparkles, Eye, Moon } from 'lucide-react';

interface ThemeSelectorProps {
  selectedThemeId: string;
  onSelectTheme: (themeId: string) => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  selectedThemeId,
  onSelectTheme,
}) => {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<ThemeCategory>('all');

  const currentTheme = getTheme(selectedThemeId);
  const displayedThemes = getThemesByCategory(activeCategory);

  const getThemeName = (theme: typeof currentTheme) => {
    try {
      const translated = t(theme.nameKey as any);
      return translated || theme.fallbackName;
    } catch {
      return theme.fallbackName;
    }
  };

  const getThemeDesc = (theme: typeof currentTheme) => {
    try {
      const translated = t(theme.descriptionKey as any);
      return translated || theme.fallbackDescription;
    } catch {
      return theme.fallbackDescription;
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
        {THEME_CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.fallbackLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Themes Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[320px] overflow-y-auto p-1 pr-1.5 scrollbar-thin">
        {displayedThemes.map(theme => {
          const isSelected = selectedThemeId === theme.id;
          const name = getThemeName(theme);
          const desc = getThemeDesc(theme);

          return (
            <div
              key={theme.id}
              onClick={() => onSelectTheme(theme.id)}
              title={desc}
              className={`relative p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between select-none ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/60 shadow-sm ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50/60'
              }`}
            >
              {/* Top: Emoji & Check */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{theme.emoji}</span>
                  {theme.isDark && (
                    <span className="p-0.5 rounded-full bg-slate-800 text-slate-200" title="ダークテーマ">
                      <Moon className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>

                {isSelected ? (
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                ) : (
                  <span className="w-4 h-4 rounded-full border border-slate-300 bg-transparent" />
                )}
              </div>

              {/* Theme Name */}
              <div className="mb-2">
                <h5 className="text-xs font-bold text-slate-900 leading-tight">
                  {name}
                </h5>
                {theme.id === 'default' && (
                  <span className="text-[10px] font-semibold text-indigo-600 block mt-0.5">
                    (デフォルト)
                  </span>
                )}
              </div>

              {/* Color Palette Dots */}
              <div className="flex items-center gap-1 mt-auto pt-1">
                {theme.previewColors.map((col, idx) => (
                  <div
                    key={idx}
                    className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs shrink-0"
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Preview Box of Selected Theme */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-indigo-600" />
            <span>{t('theme.previewTitle')}</span>
          </span>
          <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">
            <span>{currentTheme.emoji}</span>
            <span>{getThemeName(currentTheme)}</span>
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mb-2">
          {getThemeDesc(currentTheme)}
        </p>

        {/* Mini Preview Mockup */}
        <div
          className={`p-4 rounded-2xl border transition-all ${currentTheme.classes.pageBg} ${
            currentTheme.isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <div className="space-y-2.5">
            {/* Header snippet */}
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${currentTheme.classes.accentBadge}`}
              >
                <Sparkles className="w-3 h-3" />
                <span>{getThemeName(currentTheme)}</span>
              </span>
              <span className={`text-[11px] font-bold ${currentTheme.classes.mutedText}`}>
                {currentTheme.isDark ? '🌙 Dark Mode' : '☀️ Light Mode'}
              </span>
            </div>

            {/* Mock option card */}
            <div
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${currentTheme.classes.selectedOption}`}
            >
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-current opacity-80" />
                <span>サンプル選択肢 (選択中)</span>
              </div>
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>

            {/* Action button snippet */}
            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-default shadow-xs transition-all ${currentTheme.classes.primaryBtn}`}
              >
                投票ボタン
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
