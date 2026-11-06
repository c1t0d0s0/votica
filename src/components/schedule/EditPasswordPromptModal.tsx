import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { KeyRound } from 'lucide-react';

interface EditPasswordPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  voterName: string;
  /** Resolves when verified; throws (and shows the error) when the password is wrong. */
  onSubmit: (password: string) => Promise<void>;
}

export const EditPasswordPromptModal: React.FC<EditPasswordPromptModalProps> = ({
  isOpen,
  onClose,
  voterName,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    try {
      setIsVerifying(true);
      await onSubmit(password);
    } catch {
      // Error toast is shown by the caller
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('scheduleEx.passwordPromptTitle')}
      description={t('scheduleEx.passwordPromptDesc', { name: voterName })}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
            <span>{t('scheduleEx.editPasswordLabel')}</span>
          </label>
          <div className="flex gap-2">
            <input
              type={showPassword ? 'text' : 'password'}
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="flex-1 min-w-0 text-sm px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setShowPassword(v => !v)}>
              {showPassword ? t('scheduleEx.hidePassword') : t('scheduleEx.showPassword')}
            </Button>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isVerifying}>
            {t('scheduleEx.cancelBtn')}
          </Button>
          <Button type="submit" variant="primary" isLoading={isVerifying} disabled={!password}>
            {t('scheduleEx.passwordPromptBtn')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
