import React from 'react';
import { PollOption } from '../../lib/types';
import { ThemeDefinition, DisplayTheme } from '../../lib/themes';
import { Check } from 'lucide-react';

interface VoteOptionCardProps {
  option: PollOption;
  index: number;
  isSelected: boolean;
  isSingleChoice: boolean;
  isDisabled: boolean;
  onToggle: (optionId: string) => void;
  theme?: ThemeDefinition;
}

export const VoteOptionCard: React.FC<VoteOptionCardProps> = ({
  option,
  index,
  isSelected,
  isSingleChoice,
  isDisabled,
  onToggle,
  theme,
}) => {
  const selectedClass = theme
    ? theme.classes.selectedOption
    : 'border-indigo-600 bg-indigo-50/70 shadow-md shadow-indigo-100 text-indigo-950';

  const defaultOptionCardClass = theme
    ? theme.classes.optionCard
    : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/80 text-slate-800';

  // On dark-theme pages (.palette-dark scope) the palette is mirrored, so dark-only classes use
  // their mirrored shades (written literally so Tailwind compiles them; see getDisplayTheme).
  const isPaletteDark = Boolean(theme && 'scopeClass' in theme && (theme as DisplayTheme).scopeClass);
  const dark = (raw: string, mirrored: string) => (isPaletteDark ? mirrored : raw);

  const checkboxSelectedClass = theme?.isDark
    ? dark('border-cyan-400 bg-cyan-500 text-slate-950', 'border-cyan-400 bg-cyan-500 text-slate-50')
    : 'border-indigo-600 bg-indigo-600 text-white';

  return (
    <div
      onClick={() => {
        if (!isDisabled || isSelected) {
          onToggle(option.id);
        }
      }}
      className={`relative flex items-center gap-3.5 p-4 rounded-2xl border-2 transition-all cursor-pointer select-none ${
        isSelected
          ? selectedClass
          : isDisabled
          ? 'border-slate-200 bg-slate-50/60 opacity-60 cursor-not-allowed text-slate-400'
          : `${defaultOptionCardClass} shadow-sm`
      }`}
    >
      {/* Checkbox / Radio indicator */}
      <div
        className={`w-6 h-6 shrink-0 flex items-center justify-center transition-all ${
          isSingleChoice ? 'rounded-full' : 'rounded-lg'
        } border-2 ${
          isSelected
            ? checkboxSelectedClass
            : 'border-slate-300 bg-white/80 group-hover:border-slate-400'
        }`}
      >
        {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
      </div>

      {/* Color tag */}
      <div
        className="w-2.5 h-8 rounded-full shrink-0"
        style={{ backgroundColor: option.color }}
      />

      {/* Option Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${theme?.isDark ? dark('text-slate-400', 'text-slate-600') : 'text-slate-400'}`}>#{index + 1}</span>
          <h4
            className={`text-base font-semibold leading-snug break-words ${
              theme?.isDark
                ? isSelected
                  ? 'text-white font-bold'
                  : dark('text-slate-100', 'text-slate-900')
                : isSelected
                ? 'text-indigo-950 font-bold'
                : 'text-slate-800'
            }`}
          >
            {option.text}
          </h4>
        </div>
        {option.description && (
          <p className={`text-xs mt-1 leading-relaxed ${theme?.isDark ? dark('text-slate-300', 'text-slate-700') : 'text-slate-500'}`}>
            {option.description}
          </p>
        )}
      </div>
    </div>
  );
};
