import React, { useRef, useState } from 'react';
import { Copy, Check, Send, Mail, Share2, QrCode, X, PartyPopper, Link2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { Button } from '../common/Button';

/** Public URL of a poll's voting page (HashRouter). */
export function buildPollShareUrl(pollId: string): string {
  if (typeof window === 'undefined') return `#/poll/${pollId}`;
  return `${window.location.origin}${window.location.pathname}#/poll/${pollId}`;
}

interface SharePanelProps {
  pollId: string;
  pollTitle: string;
  isSchedule: boolean;
  requireAuth: boolean;
  /** 'hero' = big panel right after creation, 'card' = compact sidebar card */
  variant: 'hero' | 'card';
  onShowQr: () => void;
  onDismiss?: () => void;
}

/**
 * Inline share UI: URL + big copy button + LINE / email / native share / QR.
 * Shown prominently right after creating a poll so the next step is obvious.
 */
export const SharePanel: React.FC<SharePanelProps> = ({
  pollId,
  pollTitle,
  isSchedule,
  requireAuth,
  variant,
  onShowQr,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const url = buildPollShareUrl(pollId);
  const shareText = t(isSchedule ? 'share.shareTextSchedule' : 'share.shareTextPoll', { title: pollTitle });
  const mailHref = `mailto:?subject=${encodeURIComponent(
    t(isSchedule ? 'share.mailSubjectSchedule' : 'share.mailSubjectPoll', { title: pollTitle })
  )}&body=${encodeURIComponent(t(isSchedule ? 'share.mailBodySchedule' : 'share.mailBodyPoll', { title: pollTitle, url }))}`;
  const lineHref = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`;
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast('success', t('share.toastCopied'));
      setTimeout(() => setCopied(false), 2500);
    } catch {
      inputRef.current?.select();
      showToast('warning', t('share.toastCopyFailed'));
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: pollTitle, text: shareText, url });
    } catch {
      // cancelled by user
    }
  };

  const desc = requireAuth ? t('share.cardDescLogin') : t('share.cardDescNoLogin');

  const urlRow = (
    <div className={`flex flex-col items-stretch gap-2 ${variant === 'hero' ? 'sm:flex-row' : ''}`}>
      <input
        ref={inputRef}
        type="text"
        readOnly
        value={url}
        aria-label={t('share.pollUrlLabel')}
        onFocus={e => e.currentTarget.select()}
        className="flex-1 min-w-0 text-sm font-mono px-3.5 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
      />
      <Button
        type="button"
        variant={copied ? 'success' : 'primary'}
        size={variant === 'hero' ? 'lg' : 'md'}
        onClick={handleCopy}
        leftIcon={copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
        className="sm:min-w-[11rem]"
      >
        {copied ? t('share.copied') : t('share.copyUrl')}
      </Button>
    </div>
  );

  const actionCls =
    'flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer';
  const actions = (
    <div className={`grid gap-2 ${variant === 'hero' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
      <a href={lineHref} target="_blank" rel="noopener noreferrer" className={`${actionCls} bg-[#06C755] text-white hover:bg-[#05b34c]`}>
        <Send className="w-4 h-4" /> {t('share.shareOnLine')}
      </a>
      <a href={mailHref} className={`${actionCls} bg-white border border-slate-300 text-slate-700 hover:bg-slate-50`}>
        <Mail className="w-4 h-4" /> {t('share.shareByMail')}
      </a>
      {canNativeShare && (
        <button type="button" onClick={handleNativeShare} className={`${actionCls} bg-white border border-slate-300 text-slate-700 hover:bg-slate-50`}>
          <Share2 className="w-4 h-4" /> {t('share.shareMore')}
        </button>
      )}
      <button type="button" onClick={onShowQr} className={`${actionCls} bg-white border border-slate-300 text-slate-700 hover:bg-slate-50`}>
        <QrCode className="w-4 h-4" /> {t('share.showQr')}
      </button>
    </div>
  );

  if (variant === 'card') {
    return (
      <div className="rounded-3xl border-2 border-indigo-200 bg-indigo-50/60 p-5 space-y-3">
        <div>
          <p className="text-base font-black text-slate-900 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-indigo-600" />
            {t('share.cardTitle')}
          </p>
          <p className="text-xs text-slate-600 mt-1">{desc}</p>
        </div>
        {urlRow}
        {actions}
      </div>
    );
  }

  return (
    <section
      aria-live="polite"
      className="relative rounded-3xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 via-white to-pink-50 p-5 sm:p-7 shadow-lg space-y-4"
    >
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('share.dismiss')}
          className="absolute top-3 right-3 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      <div className="pr-8">
        <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full bg-indigo-600 text-white">
          {t('share.nextStepBadge')}
        </span>
        <h2 className="mt-3 text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
          <PartyPopper className="w-6 h-6 text-pink-500 shrink-0" />
          {isSchedule ? t('share.createdTitleSchedule') : t('share.createdTitlePoll')}
        </h2>
        <p className="text-sm sm:text-base text-slate-700 mt-1">
          {t('share.createdDesc')} {desc}
        </p>
      </div>
      {urlRow}
      {actions}
    </section>
  );
};
