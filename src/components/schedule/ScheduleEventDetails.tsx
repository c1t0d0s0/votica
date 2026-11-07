import React from 'react';
import { Poll } from '../../lib/types';
import { formatDateInfo, sanitizeHttpUrl } from '../../lib/scheduleUtils';
import { buildGoogleCalendarUrl, buildIcs, downloadIcs } from '../../lib/calendarExport';
import { useTranslation } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../common/Button';
import { MapPin, ExternalLink, Wallet, StickyNote, Users, CalendarCheck, CalendarPlus, Download, Pencil, XCircle } from 'lucide-react';

/** Current page URL used as a link back to the poll (works with HashRouter). */
function currentPageUrl(): string {
  if (typeof window === 'undefined') return '';
  return window.location.href;
}

interface EventMetaListProps {
  poll: Poll;
}

/** Location / map URL / fee / notes (#6). Renders nothing when empty. */
export const EventMetaList: React.FC<EventMetaListProps> = ({ poll }) => {
  const { t } = useTranslation();
  const mapUrl = sanitizeHttpUrl(poll.locationUrl);
  if (!poll.location && !mapUrl && !poll.fee && !poll.notes && !poll.capacity) return null;

  const rowCls = 'flex items-start gap-2 text-xs sm:text-sm text-slate-700';
  const labelCls = 'font-bold text-slate-500 shrink-0 min-w-[3.5rem]';

  return (
    <div className="mt-3 p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-1.5">
      {(poll.location || mapUrl) && (
        <div className={rowCls}>
          <MapPin className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <span className={labelCls}>{t('scheduleEx.metaLocation')}</span>
          <span className="min-w-0 break-words">
            {poll.location}
            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline ${poll.location ? 'ml-2' : ''}`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{t('scheduleEx.metaOpenMap')}</span>
              </a>
            )}
          </span>
        </div>
      )}
      {poll.fee && (
        <div className={rowCls}>
          <Wallet className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <span className={labelCls}>{t('scheduleEx.metaFee')}</span>
          <span className="min-w-0 break-words">{poll.fee}</span>
        </div>
      )}
      {poll.capacity ? (
        <div className={rowCls}>
          <Users className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <span className={labelCls}>{t('scheduleEx.metaCapacity')}</span>
          <span className="min-w-0 break-words">{t('scheduleEx.metaCapacityValue', { count: poll.capacity })}</span>
        </div>
      ) : null}
      {poll.notes && (
        <div className={rowCls}>
          <StickyNote className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <span className={labelCls}>{t('scheduleEx.metaNotes')}</span>
          <span className="min-w-0 break-words whitespace-pre-wrap">{poll.notes}</span>
        </div>
      )}
    </div>
  );
};

interface DecisionBannerProps {
  poll: Poll;
  isAdmin: boolean;
  onChange: () => void;
  onCancel: () => void;
}

/** "開催決定" banner with calendar export buttons (#2, #3). */
export const DecisionBanner: React.FC<DecisionBannerProps> = ({ poll, isAdmin, onChange, onCancel }) => {
  const { t, language } = useTranslation();
  const { showToast } = useToast();
  const decision = poll.decision;
  if (!decision) return null;

  const handleDownloadIcs = () => {
    try {
      const ics = buildIcs(poll, decision, currentPageUrl(), language);
      downloadIcs(`${poll.title}_${decision.date}`, ics);
      showToast('success', t('scheduleEx.toastIcsDownloaded'));
    } catch (e: any) {
      showToast('error', t('scheduleEx.toastFailed') + (e?.message || ''));
    }
  };

  const googleUrl = buildGoogleCalendarUrl(poll, decision, currentPageUrl(), language);

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-emerald-400/10 to-teal-500/10 border-2 border-emerald-300 shadow-sm space-y-4">
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shrink-0">
          <CalendarCheck className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <span className="text-2xs font-black tracking-wider uppercase text-emerald-800 block">
            {t('scheduleEx.decidedBannerTitle')}
          </span>
          <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5 break-words">
            {formatDateInfo(decision, language)}
          </p>
          <p className="text-xs text-emerald-900 mt-0.5 break-words">
            {t('scheduleEx.decideCandidateLabel')}: {decision.label}
            {poll.location ? ` / ${poll.location}` : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
        <Button
          variant="success"
          size="sm"
          onClick={() => window.open(googleUrl, '_blank', 'noopener,noreferrer')}
          leftIcon={<CalendarPlus className="w-4 h-4" />}
          className="w-full sm:w-auto"
        >
          {t('scheduleEx.addToGoogleCalendar')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadIcs}
          leftIcon={<Download className="w-4 h-4" />}
          className="w-full sm:w-auto"
        >
          {t('scheduleEx.downloadIcs')}
        </Button>
        {isAdmin && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onChange}
              leftIcon={<Pencil className="w-3.5 h-3.5" />}
              className="w-full sm:w-auto sm:ml-auto"
            >
              {t('scheduleEx.changeDecisionBtn')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              leftIcon={<XCircle className="w-3.5 h-3.5 text-rose-500" />}
              className="w-full sm:w-auto text-rose-600 hover:bg-rose-50"
            >
              {t('scheduleEx.cancelDecisionBtn')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
