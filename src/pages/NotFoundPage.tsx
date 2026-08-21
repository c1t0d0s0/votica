import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { useTranslation } from '../contexts/LanguageContext';
import { Vote, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
        <Vote className="w-8 h-8" />
      </div>
      <h1 className="text-4xl font-black text-slate-900 mb-2">{t('common.notFoundTitle')}</h1>
      <p className="text-sm font-semibold text-slate-600 mb-6">
        {t('common.notFoundMessage')}
      </p>
      <Link to="/">
        <Button variant="primary" size="md" leftIcon={<Home className="w-4 h-4" />}>
          {t('common.backToHome')}
        </Button>
      </Link>
    </div>
  );
};
