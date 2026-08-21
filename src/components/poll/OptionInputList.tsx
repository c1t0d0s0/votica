import React from 'react';
import { PollOption } from '../../lib/types';
import { Button } from '../common/Button';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { getOptionColor } from '../../lib/runoffUtils';
import { useTranslation } from '../../contexts/LanguageContext';

interface OptionInputListProps {
  options: PollOption[];
  onChange: (options: PollOption[]) => void;
  maxLimit?: number; // 20
}

export const OptionInputList: React.FC<OptionInputListProps> = ({
  options,
  onChange,
  maxLimit = 20,
}) => {
  const { t } = useTranslation();

  const handleAddOption = () => {
    if (options.length >= maxLimit) return;
    const newId = 'opt_' + Math.random().toString(36).substring(2, 9);
    const newOption: PollOption = {
      id: newId,
      text: '',
      color: getOptionColor(options.length),
    };
    onChange([...options, newOption]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    const updated = options.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleTextChange = (index: number, text: string) => {
    const updated = [...options];
    updated[index] = { ...updated[index], text };
    onChange(updated);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === options.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...options];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-slate-800">
          {t('optionInput.title')} <span className="text-rose-500">*</span>
        </label>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            options.length >= maxLimit
              ? 'bg-rose-100 text-rose-700'
              : 'bg-indigo-50 text-indigo-700'
          }`}
        >
          {t('optionInput.countLabel', { count: options.length, max: maxLimit })}
        </span>
      </div>

      <div className="space-y-2.5">
        {options.map((opt, index) => (
          <div
            key={opt.id}
            className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/80 p-2 rounded-xl border border-slate-200 transition-colors group"
          >
            {/* Color dot & index badge */}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm"
              style={{ backgroundColor: opt.color || getOptionColor(index) }}
            >
              {index + 1}
            </div>

            {/* Input field */}
            <input
              type="text"
              required
              value={opt.text}
              onChange={e => handleTextChange(index, e.target.value)}
              placeholder={t('optionInput.placeholder', { index: index + 1 })}
              className="flex-1 text-sm bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none focus:bg-white transition-all shadow-sm"
            />

            {/* Move Up/Down Buttons */}
            <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => handleMove(index, 'up')}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg disabled:opacity-25 disabled:hover:bg-transparent"
                title={t('optionInput.moveUp')}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={index === options.length - 1}
                onClick={() => handleMove(index, 'down')}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg disabled:opacity-25 disabled:hover:bg-transparent"
                title={t('optionInput.moveDown')}
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>

            {/* Remove button */}
            <button
              type="button"
              disabled={options.length <= 2}
              onClick={() => handleRemoveOption(index)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-400 shrink-0"
              title={options.length <= 2 ? t('optionInput.minRequired') : t('optionInput.remove')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {options.length < maxLimit && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddOption}
          leftIcon={<Plus className="w-4 h-4 text-indigo-600" />}
          className="w-full py-2.5 border-dashed border-2 hover:border-indigo-400 hover:bg-indigo-50/50 text-indigo-700 font-medium mt-2"
        >
          {t('optionInput.addOption', { remaining: maxLimit - options.length })}
        </Button>
      )}
    </div>
  );
};
