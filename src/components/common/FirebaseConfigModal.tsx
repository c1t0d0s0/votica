import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { getSavedFirebaseConfig, saveFirebaseConfig, clearFirebaseConfig, isFirebaseConfigured } from '../../lib/firebase';
import { FirebaseConfig } from '../../lib/types';
import { CheckCircle2, AlertCircle, Key } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../contexts/LanguageContext';

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const currentConfig = getSavedFirebaseConfig();

  const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '');
  const [authDomain, setAuthDomain] = useState(currentConfig?.authDomain || '');
  const [projectId, setProjectId] = useState(currentConfig?.projectId || '');
  const [storageBucket, setStorageBucket] = useState(currentConfig?.storageBucket || '');
  const [messagingSenderId, setMessagingSenderId] = useState(currentConfig?.messagingSenderId || '');
  const [appId, setAppId] = useState(currentConfig?.appId || '');
  const [jsonInput, setJsonInput] = useState('');

  const handleJsonPaste = (text: string) => {
    setJsonInput(text);
    try {
      // Find JSON block or parse directly
      const match = text.match(/\{[\s\S]*\}/);
      const jsonStr = match ? match[0] : text;
      const parsed = JSON.parse(jsonStr);
      if (parsed.apiKey) setApiKey(parsed.apiKey);
      if (parsed.authDomain) setAuthDomain(parsed.authDomain);
      if (parsed.projectId) setProjectId(parsed.projectId);
      if (parsed.storageBucket) setStorageBucket(parsed.storageBucket);
      if (parsed.messagingSenderId) setMessagingSenderId(parsed.messagingSenderId);
      if (parsed.appId) setAppId(parsed.appId);
      showToast('info', t('firebaseModal.toastJsonLoaded'));
    } catch {
      // Not valid JSON yet, ignore
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !projectId) {
      showToast('error', t('firebaseModal.toastRequiredFields'));
      return;
    }

    const newConfig: FirebaseConfig = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      projectId: projectId.trim(),
      storageBucket: storageBucket.trim(),
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim(),
    };

    saveFirebaseConfig(newConfig);
    showToast('success', t('firebaseModal.toastSaved'));
  };

  const handleClear = () => {
    if (window.confirm(t('firebaseModal.confirmReset'))) {
      clearFirebaseConfig();
      showToast('info', t('firebaseModal.toastCleared'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('firebaseModal.title')}
      description={t('firebaseModal.desc')}
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Status banner */}
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-3 ${
            isFirebaseConfigured
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          {isFirebaseConfigured ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          )}
          <div className="text-xs">
            <span className="font-bold">
              {isFirebaseConfigured ? t('firebaseModal.statusConnected') : t('firebaseModal.statusLocalDemo')}
            </span>
            <p className="mt-0.5 text-slate-600">
              {isFirebaseConfigured
                ? t('firebaseModal.statusConnectedDesc')
                : t('firebaseModal.statusLocalDemoDesc')}
            </p>
          </div>
        </div>

        {/* Quick Paste JSON */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {t('firebaseModal.quickPasteLabel')}
          </label>
          <textarea
            rows={2}
            value={jsonInput}
            onChange={e => handleJsonPaste(e.target.value)}
            placeholder={`const firebaseConfig = {\n  apiKey: "...",\n  projectId: "..."\n};`}
            className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white"
          />
        </div>

        {/* Form fields */}
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {t('firebaseModal.apiKeyLabel')}
            </label>
            <input
              type="text"
              required
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {t('firebaseModal.projectIdLabel')}
            </label>
            <input
              type="text"
              required
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              placeholder="my-votica-project"
              className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {t('firebaseModal.authDomainLabel')}
              </label>
              <input
                type="text"
                value={authDomain}
                onChange={e => setAuthDomain(e.target.value)}
                placeholder="project.firebaseapp.com"
                className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {t('firebaseModal.appIdLabel')}
              </label>
              <input
                type="text"
                value={appId}
                onChange={e => setAppId(e.target.value)}
                placeholder="1:123456:web:abcd"
                className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-100">
            {isFirebaseConfigured ? (
              <Button type="button" variant="danger" size="sm" onClick={handleClear}>
                {t('firebaseModal.resetConfigBtn')}
              </Button>
            ) : (
              <span className="text-xs text-slate-400">{t('firebaseModal.localStorageNote')}</span>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="primary" size="sm" leftIcon={<Key className="w-4 h-4" />}>
                {t('firebaseModal.saveApplyBtn')}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
