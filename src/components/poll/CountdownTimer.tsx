import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';

interface CountdownTimerProps {
  startDate: string;
  endDate: string;
  onStatusChange?: (status: 'scheduled' | 'open' | 'closed') => void;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  startDate,
  endDate,
  onStatusChange,
}) => {
  const { t } = useTranslation();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();

  const isScheduled = now < startMs;
  const isClosed = now > endMs;
  const isOpen = !isScheduled && !isClosed;

  useEffect(() => {
    if (onStatusChange) {
      if (isScheduled) onStatusChange('scheduled');
      else if (isClosed) onStatusChange('closed');
      else onStatusChange('open');
    }
  }, [isScheduled, isClosed, isOpen, onStatusChange]);

  const targetMs = isScheduled ? startMs : endMs;
  const diffMs = Math.max(0, targetMs - now);

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  const daysText = days > 0 ? `${days}${t('timer.days')}` : '';

  if (isClosed) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold">
        <CheckCircle2 className="w-4 h-4 text-slate-500" />
        <span>{t('timer.ended')}</span>
      </div>
    );
  }

  if (isScheduled) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
        <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
        <span>
          {t('timer.startsIn')} {daysText}
          {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:
          {String(seconds).padStart(2, '0')}
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <Clock className="w-4 h-4 text-emerald-600" />
      <span>
        {t('timer.openRemaining')} {daysText}
        {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:
        {String(seconds).padStart(2, '0')})
      </span>
    </div>
  );
};
