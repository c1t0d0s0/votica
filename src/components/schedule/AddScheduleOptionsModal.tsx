import React, { useEffect, useState } from 'react';
import { PollOption } from '../../lib/types';
import { MAX_SCHEDULE_CANDIDATES } from '../../lib/scheduleUtils';
import { CandidateDraft, linesFromDrafts, sortDrafts } from '../../lib/candidateDrafts';
import { useTranslation } from '../../contexts/LanguageContext';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { ScheduleCandidatePicker } from './ScheduleCandidatePicker';
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
  const [drafts, setDrafts] = useState<CandidateDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setDrafts([]);
  }, [isOpen]);

  const remaining = Math.max(0, MAX_SCHEDULE_CANDIDATES - existingOptions.length);

  const handleSubmit = async () => {
    if (drafts.length === 0) return;
    try {
      setIsSaving(true);
      await onSubmit(linesFromDrafts(sortDrafts(drafts)));
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
        <p className="text-sm text-slate-600">
          {t('scheduleEx.addOptionsRemaining', { current: existingOptions.length, max: MAX_SCHEDULE_CANDIDATES })}
          {remaining === 0 && (
            <span className="ml-2 font-semibold text-rose-600">{t('scheduleEx.addOptionsOverLimit', { remaining })}</span>
          )}
        </p>

        <ScheduleCandidatePicker value={drafts} onChange={setDrafts} existingOptions={existingOptions} compact />

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            {t('scheduleEx.cancelBtn')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isSaving}
            disabled={drafts.length === 0}
            leftIcon={<CalendarPlus className="w-4 h-4" />}
          >
            {t('scheduleEx.addOptionsSubmit', { count: drafts.length })}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
