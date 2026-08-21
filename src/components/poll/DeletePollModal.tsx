import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { deletePoll } from '../../lib/firestoreService';

interface DeletePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  pollTitle: string;
  pollId: string;
  onSuccess?: () => void;
}

export const DeletePollModal: React.FC<DeletePollModalProps> = ({
  isOpen,
  onClose,
  pollTitle,
  pollId,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deletePoll(pollId, currentUser?.uid);
      showToast('success', t('deleteModal.toastSuccess'));
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Failed to delete poll:', err);
      showToast('error', t('deleteModal.toastFailed') + (err.message || ''));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('deleteModal.title')}
      maxWidth="md"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-rose-50 border border-rose-200">
          <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="text-xs text-rose-900 leading-relaxed">
            <p className="font-bold text-sm text-rose-950 mb-1">{pollTitle}</p>
            <p>{t('deleteModal.desc', { title: pollTitle })}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
          >
            {t('deleteModal.cancelBtn')}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={handleDelete}
            isLoading={isDeleting}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            {t('deleteModal.confirmBtn')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
