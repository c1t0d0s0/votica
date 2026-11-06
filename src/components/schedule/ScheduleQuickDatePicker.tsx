import React, { useMemo, useState } from 'react';
import { Plus, Sparkles, ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import { formatQuickDate } from '../../lib/scheduleUtils';
import { useTranslation } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';

const TIME_SLOT_TEMPLATES = ['12:00〜', '18:30〜', '19:00〜', '20:00〜', '終日'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const ymdKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const keyToDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Builds the candidate lines for every (date x time slot) combination, sorted by date then slot order.
 */
export function buildCalendarCandidateLines(dateKeys: string[], slots: string[]): string[] {
  const sortedDates = [...dateKeys].sort();
  const lines: string[] = [];
  for (const key of sortedDates) {
    for (const slot of slots) {
      lines.push(formatQuickDate(keyToDate(key), slot));
    }
  }
  return lines;
}

interface ScheduleQuickDatePickerProps {
  onAddDates: (dateStrings: string[]) => void;
}

export const ScheduleQuickDatePicker: React.FC<ScheduleQuickDatePickerProps> = ({ onAddDates }) => {
  const { t, language } = useTranslation();
  const { showToast } = useToast();

  // ---- Calendar grid state ----
  const todayKey = ymdKey(new Date());
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [pickedDates, setPickedDates] = useState<string[]>([]);
  const [pickedSlots, setPickedSlots] = useState<string[]>(['19:00〜']);
  const [customSlot, setCustomSlot] = useState<string>('');

  const calendarCells = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const cells: Array<Date | null> = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  const weekdayLabels = t('scheduleEx.weekdaysShort').split(',');
  const monthLabel =
    language === 'en'
      ? viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : t('scheduleEx.monthLabel', { year: viewMonth.getFullYear(), month: viewMonth.getMonth() + 1 });

  const shiftMonth = (delta: number) => {
    setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const togglePickedDate = (key: string) => {
    setPickedDates(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  };

  const togglePickedSlot = (slot: string) => {
    setPickedSlots(prev => (prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]));
  };

  const effectiveSlots = [
    ...TIME_SLOT_TEMPLATES.filter(slot => pickedSlots.includes(slot)),
    ...(customSlot && pickedSlots.includes('__custom__') ? [customSlot] : []),
  ];
  const combinedCount = pickedDates.length * effectiveSlots.length;

  const handleAddCombined = () => {
    if (pickedDates.length === 0) {
      showToast('warning', t('scheduleEx.toastNoDate'));
      return;
    }
    if (effectiveSlots.length === 0) {
      showToast('warning', t('scheduleEx.toastNoSlot'));
      return;
    }
    const lines = buildCalendarCandidateLines(pickedDates, effectiveSlots);
    onAddDates(lines);
    showToast('success', t('scheduleEx.toastAdded', { count: lines.length }));
    setPickedDates([]);
  };
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

      {/* Calendar Grid (multi-select) */}
      <div className="bg-white border border-indigo-100 rounded-2xl p-3 sm:p-4 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
            <span>{t('scheduleEx.calendarTitle')}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label={t('scheduleEx.prevMonth')}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 min-w-[96px] text-center">{monthLabel}</span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label={t('scheduleEx.nextMonth')}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">{t('scheduleEx.calendarHelp')}</p>

        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdayLabels.map((w, i) => (
            <span
              key={w}
              className={`text-[10px] font-bold py-1 ${
                i === 0 ? 'text-rose-500' : i === 6 ? 'text-sky-600' : 'text-slate-500'
              }`}
            >
              {w}
            </span>
          ))}
          {calendarCells.map((cell, idx) => {
            if (!cell) return <span key={`empty_${idx}`} />;
            const key = ymdKey(cell);
            const isPast = key < todayKey;
            const isToday = key === todayKey;
            const isPicked = pickedDates.includes(key);
            const dow = cell.getDay();
            return (
              <button
                key={key}
                type="button"
                disabled={isPast}
                onClick={() => togglePickedDate(key)}
                aria-pressed={isPicked}
                title={isToday ? t('scheduleEx.today') : undefined}
                className={`h-9 rounded-xl text-xs font-bold transition-all select-none ${
                  isPicked
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isPast
                    ? 'text-slate-300 cursor-not-allowed'
                    : `hover:bg-indigo-50 cursor-pointer ${
                        dow === 0 ? 'text-rose-600' : dow === 6 ? 'text-sky-700' : 'text-slate-800'
                      }`
                } ${isToday && !isPicked ? 'ring-2 ring-indigo-300' : ''}`}
              >
                {cell.getDate()}
              </button>
            );
          })}
        </div>

        {/* Time slot templates */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-600">{t('scheduleEx.timeSlotsLabel')}</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {TIME_SLOT_TEMPLATES.map(slot => {
              const active = pickedSlots.includes(slot);
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => togglePickedSlot(slot)}
                  aria-pressed={active}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                  }`}
                >
                  {slot}
                </button>
              );
            })}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => togglePickedSlot('__custom__')}
                aria-pressed={pickedSlots.includes('__custom__')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                  pickedSlots.includes('__custom__')
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                }`}
              >
                {t('scheduleEx.customTime')}
              </button>
              {pickedSlots.includes('__custom__') && (
                <select
                  value={customSlot}
                  onChange={e => setCustomSlot(e.target.value)}
                  className="text-[11px] px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">--</option>
                  {timeOptions.map(tOpt => (
                    <option key={tOpt} value={tOpt}>
                      {tOpt}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            <span className="font-semibold">
              {t('scheduleEx.selectedDatesCount', { count: pickedDates.length })}
            </span>
            {pickedDates.length > 0 && (
              <button
                type="button"
                onClick={() => setPickedDates([])}
                className="inline-flex items-center gap-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>{t('scheduleEx.clearSelection')}</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleAddCombined}
            disabled={combinedCount === 0}
            className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed py-2 px-4 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('scheduleEx.addCombinedBtn', { count: combinedCount })}</span>
          </button>
        </div>
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
