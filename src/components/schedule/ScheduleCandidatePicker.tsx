import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Plus, Clock, CalendarDays, FileText, Trash2, Lock } from 'lucide-react';
import { PollOption } from '../../lib/types';
import { MAX_SCHEDULE_CANDIDATES, parseCandidateDateInfo, parseScheduleCandidateLines } from '../../lib/scheduleUtils';
import {
  ALL_TIME_OPTIONS,
  CandidateDraft,
  DatePreset,
  TIME_SLOT_TEMPLATES,
  addDates,
  changeDraftTime,
  countByDate,
  dateRange,
  draftsFromLines,
  duplicateDraftWithNewTime,
  linesFromDrafts,
  presetDates,
  removeDates,
  removeDraft,
  sortDrafts,
  toggleDate,
  ymdKey,
} from '../../lib/candidateDrafts';
import { useTranslation } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';

interface ScheduleCandidatePickerProps {
  value: CandidateDraft[];
  onChange: (drafts: CandidateDraft[]) => void;
  /** Existing (already saved) candidates: shown locked, never duplicated */
  existingOptions?: PollOption[];
  /** Show a single month even on wide screens (e.g. inside a modal) */
  compact?: boolean;
  /** Extra classes for the selected list wrapper (e.g. "lg:hidden" when a sidebar shows it) */
  listClassName?: string;
}

type DragState = { start: string; current: string; mode: 'add' | 'remove' } | null;

/**
 * Intuitive candidate date picker: tap (or drag) dates on the calendar and they become candidates
 * immediately. Supports date-only candidates and time-slot templates.
 */
export const ScheduleCandidatePicker: React.FC<ScheduleCandidatePickerProps> = ({
  value,
  onChange,
  existingOptions = [],
  compact = false,
  listClassName = '',
}) => {
  const { t, language } = useTranslation();
  const { showToast } = useToast();

  const [withTime, setWithTime] = useState(false);
  const [slots, setSlots] = useState<string[]>(['19:00〜']);
  const [customSlot, setCustomSlot] = useState('');
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [drag, setDrag] = useState<DragState>(null);
  const dragRef = useRef<DragState>(null);
  const [textOpen, setTextOpen] = useState(false);
  const [textValue, setTextValue] = useState('');

  const todayKey = ymdKey(new Date());
  const existingTexts = useMemo(() => existingOptions.map(o => o.text), [existingOptions]);
  const max = Math.max(0, MAX_SCHEDULE_CANDIDATES - existingOptions.length);

  const existingDateCounts = useMemo(() => {
    const refDate = new Date();
    return countByDate(existingOptions.map(o => ({ date: (o.dateInfo || parseCandidateDateInfo(o.text, refDate))?.date })));
  }, [existingOptions]);
  const draftDateCounts = useMemo(() => countByDate(value), [value]);

  const effectiveSlots = withTime
    ? [...TIME_SLOT_TEMPLATES.filter(s => slots.includes(s)), ...(slots.includes('__custom__') && customSlot ? [customSlot] : [])]
    : [''];

  const notifyLimit = () => showToast('warning', t('scheduleEx.pickerLimit', { max: MAX_SCHEDULE_CANDIDATES }));

  const apply = (update: { drafts: CandidateDraft[]; limited: boolean }) => {
    onChange(update.drafts);
    if (update.limited) notifyLimit();
  };

  const ensureSlots = (): boolean => {
    if (effectiveSlots.length === 0) {
      showToast('warning', t('scheduleEx.toastNoSlot'));
      return false;
    }
    return true;
  };

  // ---- Drag / tap selection ----
  // Latest values for window-level listeners (registered synchronously on pointerdown)
  const latestRef = useRef({ value, effectiveSlots, max, existingTexts });
  latestRef.current = { value, effectiveSlots, max, existingTexts };

  const finishDrag = () => {
    const state = dragRef.current;
    if (!state) return;
    dragRef.current = null;
    setDrag(null);
    const { value: current, effectiveSlots: slotsNow, max: maxNow, existingTexts: exNow } = latestRef.current;
    const dates = dateRange(state.start, state.current).filter(k => k >= todayKey);
    const noSlots = slotsNow.length === 0;
    if (state.start === state.current) {
      if (noSlots && !current.some(d => d.date === state.start)) {
        showToast('warning', t('scheduleEx.toastNoSlot'));
        return;
      }
      apply(toggleDate(current, state.start, slotsNow, maxNow, exNow));
      return;
    }
    if (state.mode === 'remove') {
      onChange(removeDates(current, dates));
    } else {
      if (noSlots) {
        showToast('warning', t('scheduleEx.toastNoSlot'));
        return;
      }
      apply(addDates(current, dates, slotsNow, maxNow, exNow));
    }
  };

  const dragRangeSet = useMemo(
    () => (drag ? new Set(dateRange(drag.start, drag.current)) : new Set<string>()),
    [drag]
  );

  const handlePointerDown = (e: React.PointerEvent, key: string) => {
    if (key < todayKey || e.button > 0) return;
    e.preventDefault();
    const initial: DragState = { start: key, current: key, mode: draftDateCounts.has(key) ? 'remove' : 'add' };
    dragRef.current = initial;
    setDrag(initial);

    const onMove = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const hovered = el?.closest<HTMLElement>('[data-date]')?.dataset.date;
      const state = dragRef.current;
      if (hovered && hovered >= todayKey && state && hovered !== state.current) {
        const next = { ...state, current: hovered };
        dragRef.current = next;
        setDrag(next);
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      finishDrag();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const handleKeyDown = (e: React.KeyboardEvent, key: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!ensureSlots() && !value.some(d => d.date === key)) return;
      apply(toggleDate(value, key, effectiveSlots, max, existingTexts));
    }
  };

  // ---- Presets / list operations ----
  const handlePreset = (preset: DatePreset) => {
    if (!ensureSlots()) return;
    apply(addDates(value, presetDates(preset), effectiveSlots, max, existingTexts));
  };

  const toggleSlot = (slot: string) => {
    setSlots(prev => (prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]));
  };

  const sorted = useMemo(() => sortDrafts(value), [value]);

  const openTextEditor = () => {
    setTextValue(linesFromDrafts(sorted).join('\n'));
    setTextOpen(true);
  };

  const applyText = () => {
    const lines = parseScheduleCandidateLines(textValue).filter(
      line => !existingTexts.some(ex => ex.trim() === line.trim())
    );
    const drafts = draftsFromLines(lines);
    if (drafts.length > max) {
      notifyLimit();
      onChange(drafts.slice(0, max));
    } else {
      onChange(drafts);
    }
    setTextOpen(false);
  };

  const months = compact ? [viewMonth] : [viewMonth, new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)];
  const weekdayLabels = t('scheduleEx.weekdaysShort').split(',');
  const monthTitle = (m: Date) =>
    language === 'en'
      ? m.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : t('scheduleEx.monthLabel', { year: m.getFullYear(), month: m.getMonth() + 1 });

  const timeLabel = (time: string) => (time === '' ? t('scheduleEx.pickerNoTime') : time);

  const chipCls = (active: boolean) =>
    `text-sm font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer select-none ${
      active ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-300 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300'
    }`;

  return (
    <div className="space-y-4">
      {/* Step 1: time mode */}
      <div className="space-y-2.5">
        <div className="inline-flex p-1 rounded-2xl bg-slate-100 border border-slate-200" role="radiogroup">
          {[
            { key: false, label: t('scheduleEx.pickerModeDateOnly'), icon: <CalendarDays className="w-4 h-4" /> },
            { key: true, label: t('scheduleEx.pickerModeWithTime'), icon: <Clock className="w-4 h-4" /> },
          ].map(opt => (
            <button
              key={String(opt.key)}
              type="button"
              role="radio"
              aria-checked={withTime === opt.key}
              onClick={() => setWithTime(opt.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                withTime === opt.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>

        {withTime && (
          <div className="space-y-1.5">
            <span className="block text-xs font-bold text-slate-600">{t('scheduleEx.pickerTimeSlots')}</span>
            <div className="flex flex-wrap items-center gap-2">
              {TIME_SLOT_TEMPLATES.map(slot => (
                <button key={slot} type="button" aria-pressed={slots.includes(slot)} onClick={() => toggleSlot(slot)} className={chipCls(slots.includes(slot))}>
                  {slot}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={slots.includes('__custom__')}
                onClick={() => toggleSlot('__custom__')}
                className={chipCls(slots.includes('__custom__'))}
              >
                {t('scheduleEx.customTime')}
              </button>
              {slots.includes('__custom__') && (
                <select
                  value={customSlot}
                  onChange={e => setCustomSlot(e.target.value)}
                  aria-label={t('scheduleEx.customTime')}
                  className="text-sm px-3 py-1.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">--</option>
                  {ALL_TIME_OPTIONS.map(o => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: calendar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            aria-label={t('scheduleEx.prevMonth')}
            className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="text-xs text-slate-500 text-center px-2">{t('scheduleEx.pickerCalendarHelp')}</p>
          <button
            type="button"
            onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            aria-label={t('scheduleEx.nextMonth')}
            className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className={`grid gap-6 ${compact ? '' : 'md:grid-cols-2'}`}>
          {months.map((month, mi) => {
            const first = new Date(month.getFullYear(), month.getMonth(), 1);
            const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
            const cells: Array<string | null> = [];
            for (let i = 0; i < first.getDay(); i++) cells.push(null);
            for (let d = 1; d <= days; d++) cells.push(ymdKey(new Date(month.getFullYear(), month.getMonth(), d)));
            while (cells.length % 7 !== 0) cells.push(null);
            return (
              <div key={ymdKey(month)} className={mi === 1 ? 'hidden md:block' : ''}>
                <p className="text-sm font-black text-slate-800 text-center mb-2">{monthTitle(month)}</p>
                <div className="grid grid-cols-7 gap-1 select-none" style={{ touchAction: 'none' }}>
                  {weekdayLabels.map((w, i) => (
                    <span
                      key={w}
                      className={`text-xs font-bold text-center py-1 ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-sky-600' : 'text-slate-500'}`}
                    >
                      {w}
                    </span>
                  ))}
                  {cells.map((key, idx) => {
                    if (!key) return <span key={`e${idx}`} />;
                    const dow = idx % 7;
                    const isPast = key < todayKey;
                    const draftCount = draftDateCounts.get(key) || 0;
                    const existingCount = existingDateCounts.get(key) || 0;
                    const inDrag = dragRangeSet.has(key) && !isPast;
                    const willRemove = inDrag && drag?.mode === 'remove';
                    const selected = (draftCount > 0 && !willRemove) || (inDrag && drag?.mode === 'add');
                    return (
                      <button
                        key={key}
                        type="button"
                        data-date={key}
                        disabled={isPast}
                        aria-pressed={draftCount > 0}
                        aria-label={key}
                        onPointerDown={e => handlePointerDown(e, key)}
                        onKeyDown={e => handleKeyDown(e, key)}
                        className={`relative h-10 sm:h-11 rounded-xl text-sm font-bold transition-colors ${
                          selected
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : willRemove
                            ? 'bg-rose-100 text-rose-700'
                            : isPast
                            ? 'text-slate-300 cursor-not-allowed'
                            : `hover:bg-indigo-50 cursor-pointer ${dow === 0 ? 'text-rose-600' : dow === 6 ? 'text-sky-700' : 'text-slate-800'}`
                        } ${key === todayKey && !selected ? 'ring-2 ring-indigo-300' : ''}`}
                      >
                        {Number(key.slice(8))}
                        {(draftCount > 1 || existingCount > 0) && (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                            {existingCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                            {draftCount > 1 && <span className={`w-1.5 h-1.5 rounded-full ${selected ? 'bg-white' : 'bg-indigo-500'}`} />}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-500">{t('scheduleEx.pickerQuick')}:</span>
          {(
            [
              ['weekend', t('schedule.presetWeekend')],
              ['nextWeekdays', t('schedule.presetNextWeekdays')],
              ['next7', t('schedule.preset7Days')],
            ] as Array<[DatePreset, string]>
          ).map(([preset, label]) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePreset(preset)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 cursor-pointer"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Step 3: selected candidates */}
      <div className={listClassName}>
        <CandidateDraftList
          drafts={sorted}
          existingCount={existingOptions.length}
          onRemove={id => onChange(removeDraft(value, id))}
          onChangeTime={(id, time) => onChange(changeDraftTime(value, id, time, existingTexts))}
          onDuplicate={id => apply(duplicateDraftWithNewTime(value, id, max, existingTexts))}
          onClear={() => onChange([])}
          timeLabel={timeLabel}
        />
      </div>

      {/* Text editing (paste / power users) */}
      <div className="rounded-2xl border border-dashed border-slate-300">
        {!textOpen ? (
          <button
            type="button"
            onClick={openTextEditor}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-slate-600 hover:text-indigo-700 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>{t('scheduleEx.pickerTextEdit')}</span>
          </button>
        ) : (
          <div className="p-3 sm:p-4 space-y-2">
            <p className="text-xs text-slate-500">{t('scheduleEx.pickerTextHint')}</p>
            <textarea
              rows={6}
              value={textValue}
              onChange={e => setTextValue(e.target.value)}
              placeholder={t('schedule.candidateTextareaPlaceholder')}
              className="w-full font-mono text-sm px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTextOpen(false)}
                className="text-sm font-bold px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {t('scheduleEx.cancelBtn')}
              </button>
              <button
                type="button"
                onClick={applyText}
                className="text-sm font-bold px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
              >
                {t('scheduleEx.pickerTextApply')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface CandidateDraftListProps {
  drafts: CandidateDraft[];
  existingCount?: number;
  onRemove: (id: string) => void;
  onChangeTime?: (id: string, time: string) => void;
  onDuplicate?: (id: string) => void;
  onClear?: () => void;
  timeLabel?: (time: string) => string;
  /** Limit height and scroll (for sidebars) */
  scrollable?: boolean;
}

/** List of selected candidates (sorted). Used inside the picker and in the create-page sidebar. */
export const CandidateDraftList: React.FC<CandidateDraftListProps> = ({
  drafts,
  existingCount = 0,
  onRemove,
  onChangeTime,
  onDuplicate,
  onClear,
  timeLabel,
  scrollable = false,
}) => {
  const { t } = useTranslation();
  const label = timeLabel || ((time: string) => (time === '' ? t('scheduleEx.pickerNoTime') : time));

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-black text-slate-800">
          {t('scheduleEx.pickerSelectedTitle')}
          <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
            {t('scheduleEx.pickerCount', { count: drafts.length })}
          </span>
        </span>
        {existingCount > 0 && (
          <span className="text-xs text-slate-500 inline-flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            {t('scheduleEx.pickerExisting', { count: existingCount })}
          </span>
        )}
        {onClear && drafts.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-bold text-slate-500 hover:text-rose-600 inline-flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('scheduleEx.pickerClearAll')}
          </button>
        )}
      </div>

      {drafts.length === 0 ? (
        <p className="text-sm text-slate-500 py-3 text-center">{t('scheduleEx.pickerEmpty')}</p>
      ) : (
        <ul className={`space-y-1.5 ${scrollable ? 'max-h-[45vh] overflow-y-auto pr-1' : ''}`}>
          {drafts.map(d => (
            <li key={d.id} className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2">
              <span className="flex-1 min-w-0 text-sm font-bold text-slate-900 truncate" title={d.text}>
                {d.text}
              </span>
              {onChangeTime && d.date && d.time !== undefined && (
                <select
                  value={d.time}
                  onChange={e => onChangeTime(d.id, e.target.value)}
                  aria-label={t('scheduleEx.timeSlotsLabel')}
                  className="text-xs px-2 py-1 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none max-w-[7.5rem]"
                >
                  <option value="">{label('')}</option>
                  {ALL_TIME_OPTIONS.map(o => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              )}
              {onDuplicate && d.date && (
                <button
                  type="button"
                  onClick={() => onDuplicate(d.id)}
                  title={t('scheduleEx.pickerAddTime')}
                  aria-label={t('scheduleEx.pickerAddTime')}
                  className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(d.id)}
                title={t('scheduleEx.pickerRemove')}
                aria-label={t('scheduleEx.pickerRemove')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
