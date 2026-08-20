import React from 'react';
import { PollOption } from '../../lib/types';
import { Check } from 'lucide-react';

interface VoteOptionCardProps {
  option: PollOption;
  index: number;
  isSelected: boolean;
  isSingleChoice: boolean;
  isDisabled: boolean;
  onToggle: (optionId: string) => void;
}

export const VoteOptionCard: React.FC<VoteOptionCardProps> = ({
  option,
  index,
  isSelected,
  isSingleChoice,
  isDisabled,
  onToggle,
}) => {
  return (
    <div
      onClick={() => {
        if (!isDisabled || isSelected) {
          onToggle(option.id);
        }
      }}
      className={`relative flex items-center gap-3.5 p-4 rounded-2xl border-2 transition-all cursor-pointer select-none ${
        isSelected
          ? 'border-indigo-600 bg-indigo-50/70 shadow-md shadow-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-500'
          : isDisabled
          ? 'border-slate-200 bg-slate-50/60 opacity-60 cursor-not-allowed'
          : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/80 shadow-sm'
      }`}
    >
      {/* Checkbox / Radio indicator */}
      <div
        className={`w-6 h-6 shrink-0 flex items-center justify-center transition-all ${
          isSingleChoice ? 'rounded-full' : 'rounded-lg'
        } border-2 ${
          isSelected
            ? 'border-indigo-600 bg-indigo-600 text-white'
            : 'border-slate-300 bg-white group-hover:border-slate-400'
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
          <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
          <h4
            className={`text-base font-semibold leading-snug break-words ${
              isSelected ? 'text-indigo-950 dark:text-indigo-100' : 'text-slate-800'
            }`}
          >
            {option.text}
          </h4>
        </div>
        {option.description && (
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{option.description}</p>
        )}
      </div>
    </div>
  );
};
