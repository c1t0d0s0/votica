import React, { useEffect, useState } from 'react';
import { Poll, PollEventInfo } from '../../lib/types';
import { sanitizeHttpUrl } from '../../lib/scheduleUtils';
import { useTranslation } from '../../contexts/LanguageContext';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface EditEventInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  poll: Poll;
  onSave: (info: PollEventInfo) => Promise<void>;
}

export const EditEventInfoModal: React.FC<EditEventInfoModalProps> = ({ isOpen, onClose, poll, onSave }) => {
  const { t } = useTranslation();
  const [location, setLocation] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [fee, setFee] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLocation(poll.location || '');
    setLocationUrl(poll.locationUrl || '');
    setFee(poll.fee || '');
    setNotes(poll.notes || '');
  }, [isOpen, poll]);

  const isUrlInvalid = locationUrl.trim() !== '' && !sanitizeHttpUrl(locationUrl);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUrlInvalid) return;
    try {
      setIsSaving(true);
      await onSave({ location, locationUrl, fee, notes });
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls =
    'w-full text-sm px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('scheduleEx.editEventInfoTitle')}
      description={t('scheduleEx.editEventInfoDesc')}
      maxWidth="lg"
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">{t('scheduleEx.locationLabel')}</label>
          <input
            type="text"
            maxLength={200}
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder={t('scheduleEx.locationPlaceholder')}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">{t('scheduleEx.locationUrlLabel')}</label>
          <input
            type="url"
            inputMode="url"
            maxLength={1000}
            value={locationUrl}
            onChange={e => setLocationUrl(e.target.value)}
            placeholder={t('scheduleEx.locationUrlPlaceholder')}
            aria-invalid={isUrlInvalid}
            className={`${inputCls} ${isUrlInvalid ? 'border-rose-400 focus:ring-rose-400' : ''}`}
          />
          {isUrlInvalid && <p className="text-[11px] text-rose-600 mt-1">{t('scheduleEx.invalidUrl')}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">{t('scheduleEx.feeLabel')}</label>
          <input
            type="text"
            maxLength={100}
            value={fee}
            onChange={e => setFee(e.target.value)}
            placeholder={t('scheduleEx.feePlaceholder')}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">{t('scheduleEx.notesLabel')}</label>
          <textarea
            rows={3}
            maxLength={1000}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t('scheduleEx.notesPlaceholder')}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            {t('scheduleEx.cancelBtn')}
          </Button>
          <Button type="submit" variant="primary" isLoading={isSaving} disabled={isUrlInvalid}>
            {t('scheduleEx.saveBtn')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
