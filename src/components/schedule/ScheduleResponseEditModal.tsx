import React, { useEffect, useState } from 'react';
import { PollOption, ScheduleChoice, Vote } from '../../lib/types';
import { useTranslation } from '../../contexts/LanguageContext';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { ScheduleVotingTable } from './ScheduleVotingTable';
import { ShieldCheck, Trash2, AlertTriangle } from 'lucide-react';

export interface ScheduleResponseEditValues {
  userDisplayName: string;
  scheduleResponses: Record<string, ScheduleChoice>;
  comment: string;
}

interface ScheduleResponseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: PollOption[];
  vote: Vote | null;
  /** 'admin' = organizer editing someone else's response, 'owner' = respondent (verified by edit key) */
  mode: 'admin' | 'owner';
  onSave: (values: ScheduleResponseEditValues) => Promise<void>;
  onDelete: () => Promise<void>;
  lockedCircleOptionIds?: Set<string>;
  capacity?: number | null;
  circleCounts?: Record<string, number>;
}

/**
 * Edit / delete a single schedule response. Used by the organizer (#1) and by
 * anonymous respondents who verified their edit password (#4).
 */
export const ScheduleResponseEditModal: React.FC<ScheduleResponseEditModalProps> = ({
  isOpen,
  onClose,
  options,
  vote,
  mode,
  onSave,
  onDelete,
  lockedCircleOptionIds,
  capacity,
  circleCounts,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [responses, setResponses] = useState<Record<string, ScheduleChoice>>({});
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (!isOpen || !vote) return;
    setName(vote.userDisplayName || '');
    if (vote.scheduleResponses) {
      setResponses({ ...vote.scheduleResponses });
    } else {
      const resp: Record<string, ScheduleChoice> = {};
      options.forEach(opt => {
        resp[opt.id] = vote.selectedOptionIds?.includes(opt.id) ? 'circle' : 'cross';
      });
      setResponses(resp);
    }
    setComment(vote.comment || '');
    setConfirmingDelete(false);
    setNameError(false);
  }, [isOpen, vote, options]);

  if (!vote) return null;

  const displayName = vote.userDisplayName || t('common.user');

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    try {
      setIsSaving(true);
      await onSave({ userDisplayName: name.trim(), scheduleResponses: responses, comment: comment.trim() });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  const setAll = (choice: ScheduleChoice) => {
    const next: Record<string, ScheduleChoice> = {};
    options.forEach(opt => {
      next[opt.id] = choice;
    });
    setResponses(next);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('scheduleEx.editModalTitle', { name: displayName })}
      maxWidth="2xl"
    >
      {confirmingDelete ? (
        <div className="space-y-5">
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-900">
              <p className="font-bold text-sm">{t('scheduleEx.confirmDeleteTitle')}</p>
              <p className="mt-1">{t('scheduleEx.confirmDeleteDesc', { name: displayName })}</p>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmingDelete(false)} disabled={isDeleting}>
              {t('scheduleEx.cancelBtn')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={isDeleting}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              {t('scheduleEx.confirmDeleteBtn')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {mode === 'admin' && (
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{t('scheduleEx.editModalAdminNote')}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('scheduleEx.nameLabel')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              maxLength={50}
              onChange={e => {
                setName(e.target.value);
                setNameError(false);
              }}
              className={`w-full text-sm px-3.5 py-2 rounded-xl border bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                nameError ? 'border-rose-400' : 'border-slate-300'
              }`}
            />
            {nameError && (
              <p className="text-[11px] text-rose-600 mt-1">{t('scheduleEx.toastNameRequired')}</p>
            )}
          </div>

          <div className="max-h-[50vh] overflow-y-auto pr-1">
            <ScheduleVotingTable
              options={options}
              responses={responses}
              onChangeResponse={(optionId, choice) => setResponses(prev => ({ ...prev, [optionId]: choice }))}
              onSetAllResponses={setAll}
              lockedCircleOptionIds={lockedCircleOptionIds}
              capacity={capacity}
              circleCounts={circleCounts}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('scheduleEx.commentLabel')}
            </label>
            <input
              type="text"
              value={comment}
              maxLength={200}
              onChange={e => setComment(e.target.value)}
              className="w-full text-sm px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmingDelete(true)}
              leftIcon={<Trash2 className="w-4 h-4 text-rose-500" />}
              className="text-rose-600 hover:bg-rose-50"
            >
              {t('scheduleEx.deleteBtn')}
            </Button>
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" onClick={onClose} disabled={isSaving}>
                {t('scheduleEx.cancelBtn')}
              </Button>
              <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
                {t('scheduleEx.saveBtn')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
