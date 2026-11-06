import React, { useEffect, useMemo, useState } from 'react';
import { PollOption } from '../../lib/types';
import {
  MAX_SCHEDULE_CANDIDATES,
  classifyNewCandidateLines,
  parseScheduleCandidateLines,
} from '../../lib/scheduleUtils';
import { useTranslation } from '../../contexts/LanguageContext';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { ScheduleQuickDatePicker } from './ScheduleQuickDatePicker';
import { CalendarPlus } from 'lucide-react';

interface AddScheduleOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingOptions: PollOption[];
  onSubmit: (lines: string[]) => Promise<void>;
}

/** Admin modal to add candidate dates to an existing schedule poll. */
export const AddScheduleOptionsModal: React.FC<AddScheduleOptionsModalProps> = ({
  isOpen,
  onClose,
  existingOptions,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setText('');
  }, [isOpen]);

  const { newLines, duplicateLines } = useMemo(
    () => classifyNewCandidateLines(existingOptions, parseScheduleCandidateLines(text)),
    [existingOptions, text]
  );
  const remaining = Math.max(0, MAX_SCHEDULE_CANDIDATES - existingOptions.length);
  const overLimit = newLines.length > remaining;

  const handleAddFromPicker = (dates: string[]) => {
    setText(prev => (prev.trim() ? `${prev.trim()}\n${dates.join('\n')}` : dates.join('\n')));
  };

  const handleSubmit = async () => {
    if (newLines.length === 0 || overLimit) return;
    try {
      setIsSaving(true);
      await onSubmit(newLines);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('scheduleEx.addOptionsTitle')}
      description={t('scheduleEx.addOptionsDesc')}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        <ScheduleQuickDatePicker onAddDates={handleAddFromPicker} />

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            {t('schedule.candidateTextareaLabel')}
          </label>
          <textarea
            rows={5}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={t('schedule.candidateTextareaPlaceholder')}
            className="w-full font-mono text-xs sm:text-sm px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-1.5">
          <p className="font-bold text-slate-800">
            {t('scheduleEx.addOptionsPreview', { count: newLines.length })}
            <span className="ml-2 font-normal text-slate-500">
              {t('scheduleEx.addOptionsRemaining', {
                current: existingOptions.length,
                max: MAX_SCHEDULE_CANDIDATES,
              })}
            </span>
          </p>
          {duplicateLines.length > 0 && (
            <p className="text-amber-700">
              {t('scheduleEx.addOptionsDuplicates', { count: duplicateLines.length })}: {duplicateLines.join(' / ')}
            </p>
          )}
          {overLimit && (
            <p className="font-semibold text-rose-600">
              {t('scheduleEx.addOptionsOverLimit', { remaining })}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            {t('scheduleEx.cancelBtn')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isSaving}
            disabled={newLines.length === 0 || overLimit}
            leftIcon={<CalendarPlus className="w-4 h-4" />}
          >
            {t('scheduleEx.addOptionsSubmit', { count: newLines.length })}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
