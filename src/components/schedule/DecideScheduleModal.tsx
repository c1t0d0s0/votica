import React, { useEffect, useState } from 'react';
import { Poll, PollRound, ScheduleDecision, ScheduleResultSummary } from '../../lib/types';
import { buildDecisionFromOption, getScheduleSymbol } from '../../lib/scheduleUtils';
import { useTranslation } from '../../contexts/LanguageContext';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Crown, CalendarCheck } from 'lucide-react';

interface DecideScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  poll: Poll;
  round: PollRound;
  summary: ScheduleResultSummary;
  onConfirm: (decision: ScheduleDecision) => Promise<void>;
}

export const DecideScheduleModal: React.FC<DecideScheduleModalProps> = ({
  isOpen,
  onClose,
  poll,
  round,
  summary,
  onConfirm,
}) => {
  const { t, language } = useTranslation();
  const [optionId, setOptionId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const refDate = new Date(round.startDate || poll.createdAt);

  const applyOption = (id: string) => {
    const opt = round.options.find(o => o.id === id);
    if (!opt) return;
    const d = buildDecisionFromOption(opt, refDate);
    setOptionId(id);
    setDate(d.date);
    setStartTime(d.startTime || '');
    setEndTime(d.endTime || '');
    setAllDay(d.allDay);
    setError('');
  };

  useEffect(() => {
    if (!isOpen) return;
    const current = poll.decision;
    if (current && round.options.some(o => o.id === current.optionId)) {
      setOptionId(current.optionId);
      setDate(current.date);
      setStartTime(current.startTime || '');
      setEndTime(current.endTime || '');
      setAllDay(current.allDay);
      setError('');
    } else {
      applyOption(summary.bestOptions[0]?.option.id || round.options[0]?.id || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleConfirm = async () => {
    const opt = round.options.find(o => o.id === optionId);
    if (!opt) return;
    if (!date) {
      setError(t('scheduleEx.toastDateRequired'));
      return;
    }
    if (!allDay && !startTime) {
      setError(t('scheduleEx.toastStartRequired'));
      return;
    }
    const decision: ScheduleDecision = {
      optionId: opt.id,
      label: opt.text,
      date,
      allDay,
      decidedAt: new Date().toISOString(),
    };
    if (!allDay) {
      decision.startTime = startTime;
      if (endTime) decision.endTime = endTime;
    }
    try {
      setIsSaving(true);
      await onConfirm(decision);
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls =
    'w-full text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('scheduleEx.decideModalTitle')}
      description={t('scheduleEx.decideModalDesc')}
      maxWidth="xl"
    >
      <div className="space-y-5">
        <div>
          <span className="block text-xs font-bold text-slate-700 mb-2">{t('scheduleEx.decideCandidateLabel')}</span>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {summary.options.map(optSummary => {
              const selected = optSummary.option.id === optionId;
              return (
                <label
                  key={optSummary.option.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    selected ? 'border-indigo-500 bg-indigo-50/70' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <input
                      type="radio"
                      name="decide-option"
                      checked={selected}
                      onChange={() => applyOption(optSummary.option.id)}
                      className="w-4 h-4 text-indigo-600"
                    />
                    {optSummary.isBest && <Crown className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />}
                    <span className="text-sm font-bold text-slate-900 truncate">{optSummary.option.text}</span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 shrink-0">
                    {getScheduleSymbol('circle', language)}
                    {optSummary.circleCount} {getScheduleSymbol('triangle', language)}
                    {optSummary.triangleCount} {getScheduleSymbol('cross', language)}
                    {optSummary.crossCount}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
          <p className="text-[11px] text-slate-500">{t('scheduleEx.decideParsedHint')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t('scheduleEx.decideDateLabel')}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t('scheduleEx.decideStartLabel')}</label>
              <input
                type="time"
                value={startTime}
                disabled={allDay}
                onChange={e => setStartTime(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t('scheduleEx.decideEndLabel')}</label>
              <input
                type="time"
                value={endTime}
                disabled={allDay}
                onChange={e => setEndTime(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={allDay}
              onChange={e => setAllDay(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300"
            />
            <span>{t('scheduleEx.decideAllDayLabel')}</span>
          </label>
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            {t('scheduleEx.cancelBtn')}
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            isLoading={isSaving}
            disabled={!optionId}
            leftIcon={<CalendarCheck className="w-4 h-4" />}
          >
            {t('scheduleEx.decideConfirmBtn')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
