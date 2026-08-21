import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Copy, Check, Send } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../contexts/LanguageContext';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  pollTitle: string;
  pollId: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  pollTitle,
  pollId,
}) => {
  const { showToast } = useToast();
  const { t, language } = useTranslation();
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}${window.location.pathname}#/poll/${pollId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    showToast('success', t('share.toastCopied'));
    setTimeout(() => setCopied(false), 2000);
  };

  const xTweetText =
    language === 'ja'
      ? `【投票のお願い】「${pollTitle}」に投票しよう！ #Votica\n`
      : `Vote on "${pollTitle}"! #Votica\n`;

  const xShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    xTweetText
  )}&url=${encodeURIComponent(shareUrl)}`;

  const lineShareUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(
    shareUrl
  )}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('share.title')}
      description={t('share.desc')}
      maxWidth="md"
    >
      <div className="space-y-6 text-center">
        {/* QR Code Container */}
        <div className="flex justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block mx-auto shadow-inner">
          <QRCodeSVG
            value={shareUrl}
            size={180}
            level="M"
            includeMargin={true}
            className="rounded-lg shadow-sm"
          />
        </div>

        {/* Copy Link Input */}
        <div className="space-y-1.5 text-left">
          <label className="text-xs font-semibold text-slate-600">{t('share.pollUrlLabel')}</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 text-xs bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-mono select-all focus:outline-none"
            />
            <Button
              type="button"
              variant={copied ? 'success' : 'primary'}
              size="sm"
              onClick={handleCopy}
              leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            >
              {copied ? t('share.copied') : t('share.copy')}
            </Button>
          </div>
        </div>

        {/* Social Share Buttons */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-3">
          <a
            href={xShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-black text-white hover:bg-slate-800 text-xs font-semibold transition-colors"
          >
            <span className="font-bold">𝕏</span> {t('share.shareOnX')}
          </a>
          <a
            href={lineShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#06C755] text-white hover:bg-[#05b34c] text-xs font-semibold transition-colors"
          >
            <Send className="w-3.5 h-3.5" /> {t('share.shareOnLine')}
          </a>
        </div>
      </div>
    </Modal>
  );
};
