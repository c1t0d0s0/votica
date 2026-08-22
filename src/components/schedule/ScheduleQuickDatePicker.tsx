import React, { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { formatQuickDate } from '../../lib/scheduleUtils';
import { useTranslation } from '../../contexts/LanguageContext';

interface ScheduleQuickDatePickerProps {
  onAddDates: (dateStrings: string[]) => void;
}

export const ScheduleQuickDatePicker: React.FC<ScheduleQuickDatePickerProps> = ({ onAddDates }) => {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [selectedTime, setSelectedTime] = useState<string>('19:00〜');

  const handleAddSingle = () => {
    if (!selectedDate) return;
    const parts = selectedDate.split('-');
    if (parts.length !== 3) return;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const formatted = formatQuickDate(d, selectedTime);
    onAddDates([formatted]);
  };

  const handleAddNextDays = (daysCount: number) => {
    const list: string[] = [];
    const base = selectedDate ? new Date(selectedDate) : new Date();
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      list.push(formatQuickDate(d, selectedTime));
    }
    onAddDates(list);
  };

  const handleAddThisWeekend = () => {
    const list: string[] = [];
    const now = new Date();
    // find upcoming Saturday
    const sat = new Date(now);
    const day = now.getDay();
    const diffSat = (6 - day + 7) % 7;
    sat.setDate(now.getDate() + diffSat);

    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);

    list.push(formatQuickDate(sat, '13:00〜'));
    list.push(formatQuickDate(sat, '18:00〜'));
    list.push(formatQuickDate(sun, '13:00〜'));
    list.push(formatQuickDate(sun, '18:00〜'));

    onAddDates(list);
  };

  const handleAddNextWeekWeekdays = () => {
    const list: string[] = [];
    const now = new Date();
    // find next Monday
    const nextMon = new Date(now);
    const day = now.getDay();
    const diffMon = (1 - day + 7) % 7 || 7;
    nextMon.setDate(now.getDate() + diffMon);

    for (let i = 0; i < 5; i++) {
      const d = new Date(nextMon);
      d.setDate(nextMon.getDate() + i);
      list.push(formatQuickDate(d, selectedTime));
    }
    onAddDates(list);
  };

  const generateTimeOptions = (): string[] => {
    const options: string[] = [];
    for (let h = 0; h < 24; h++) {
      options.push(`${h}:00〜`);
      options.push(`${h}:30〜`);
    }
    options.push('終日');
    return options;
  };

  const timeOptions = generateTimeOptions();

  return (
    <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3.5 sm:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>{t('schedule.quickAddTitle')}</span>
        </span>
        <span className="text-[11px] text-indigo-600">
          {t('schedule.quickAddHelp')}
        </span>
      </div>

      {/* Date & Time Picker Row */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div className="sm:col-span-5 relative">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-xs"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={selectedTime}
            onChange={e => setSelectedTime(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-xs font-medium"
          >
            {timeOptions.map(tOpt => (
              <option key={tOpt} value={tOpt}>
                {tOpt}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <button
            type="button"
            onClick={handleAddSingle}
            className="w-full h-full text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 py-2 px-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('schedule.addCandidateBtn')}</span>
          </button>
        </div>
      </div>

      {/* Quick batch presets */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1">
        <span className="text-[11px] text-slate-500 font-semibold mr-1">
          {t('schedule.presetLabel')}:
        </span>
        <button
          type="button"
          onClick={() => handleAddNextDays(3)}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100/60 transition-colors shadow-2xs cursor-pointer"
        >
          {t('schedule.preset3Days')}
        </button>
        <button
          type="button"
          onClick={() => handleAddNextDays(7)}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100/60 transition-colors shadow-2xs cursor-pointer"
        >
          {t('schedule.preset7Days')}
        </button>
        <button
          type="button"
          onClick={handleAddThisWeekend}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100/60 transition-colors shadow-2xs cursor-pointer"
        >
          {t('schedule.presetWeekend')}
        </button>
        <button
          type="button"
          onClick={handleAddNextWeekWeekdays}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100/60 transition-colors shadow-2xs cursor-pointer"
        >
          {t('schedule.presetNextWeekdays')}
        </button>
      </div>
    </div>
  );
};
