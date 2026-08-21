import React, { useState } from 'react';
import { Vote, Scale } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import { OssLicensesModal } from '../common/OssLicensesModal';

export const Footer: React.FC = () => {
  const { t } = useTranslation();
  const [isOssModalOpen, setIsOssModalOpen] = useState(false);

  return (
    <>
      <footer className="border-t border-slate-200 bg-white/50 backdrop-blur-sm py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Vote className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold text-slate-700">Votica</span>
            <span>{t('footer.subtitle')}</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400 font-medium">
            <button
              onClick={() => setIsOssModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 hover:underline transition-colors focus:outline-none"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>{t('footer.ossLicenses')}</span>
            </button>
            <span className="text-slate-300">|</span>
            <span>&copy; {new Date().getFullYear()} cuio.net</span>
          </div>
        </div>
      </footer>

      <OssLicensesModal
        isOpen={isOssModalOpen}
        onClose={() => setIsOssModalOpen(false)}
      />
    </>
  );
};
