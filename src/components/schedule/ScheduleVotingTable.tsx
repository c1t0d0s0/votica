import { PollOption, ScheduleChoice } from '../../lib/types';
import { SCHEDULE_SYMBOLS, getScheduleSymbol } from '../../lib/scheduleUtils';
import { useTranslation } from '../../contexts/LanguageContext';

interface ScheduleVotingTableProps {
  options: PollOption[];
  responses: Record<string, ScheduleChoice>;
  onChangeResponse: (optionId: string, choice: ScheduleChoice) => void;
  onSetAllResponses: (choice: ScheduleChoice) => void;
  disabled?: boolean;
}

export const ScheduleVotingTable: React.FC<ScheduleVotingTableProps> = ({
  options,
  responses,
  onChangeResponse,
  onSetAllResponses,
  disabled = false,
}) => {
  const { t, language } = useTranslation();

  const choices: ScheduleChoice[] = ['circle', 'triangle', 'cross'];

  return (
    <div className="space-y-4">
      {/* Batch Select Controls */}
      {!disabled && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2.5">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <span>{t('schedule.batchSelectLabel')}:</span>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSetAllResponses('circle')}
              className="px-2.5 py-1 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <span>{t('schedule.allCircle')}</span>
            </button>
            <button
              type="button"
              onClick={() => onSetAllResponses('triangle')}
              className="px-2.5 py-1 text-xs font-bold rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <span>{t('schedule.allTriangle')}</span>
            </button>
            <button
              type="button"
              onClick={() => onSetAllResponses('cross')}
              className="px-2.5 py-1 text-xs font-bold rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <span>{t('schedule.allCross')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Date Candidates List */}
      <div className="space-y-2.5">
        {options.map(option => {
          const currentChoice = responses[option.id];

          return (
            <div
              key={option.id}
              className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                currentChoice
                  ? 'bg-white border-slate-300 shadow-sm'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-2.5 h-8 sm:h-9 rounded-full shrink-0"
                  style={{ backgroundColor: option.color || '#6366f1' }}
                />
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">
                    {option.text}
                  </h4>
                  {option.description && (
                    <p className="text-xs text-slate-400 mt-0.5">{option.description}</p>
                  )}
                </div>
              </div>

              {/* 3-Choice Button Group */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 shrink-0 min-w-[190px] sm:min-w-[210px]">
                {choices.map(c => {
                  const meta = SCHEDULE_SYMBOLS[c];
                  const isSelected = currentChoice === c;

                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChangeResponse(option.id, c)}
                      className={`px-2 py-2 sm:px-3 sm:py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer select-none ${
                        isSelected
                          ? `${meta.bgClass} ${meta.borderClass} ${meta.textClass} border-2 shadow-xs scale-102`
                          : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:text-slate-800'
                      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="text-base sm:text-lg font-bold leading-none">
                        {getScheduleSymbol(c, language)}
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-medium leading-none">
                        {language === 'ja' ? meta.labelJa.split(' ')[0] : meta.labelEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
