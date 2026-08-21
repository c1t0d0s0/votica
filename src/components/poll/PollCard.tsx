import React from 'react';
import { Link } from 'react-router-dom';
import { Poll } from '../../lib/types';
import { Swords, Lock, Globe, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';

interface PollCardProps {
  poll: Poll;
  isCreator?: boolean;
}

export const PollCard: React.FC<PollCardProps> = ({ poll, isCreator }) => {
  const { t } = useTranslation();
  const isClosed = poll.status === 'closed';
  const isRunoffActive = !isClosed && poll.totalRounds > 1;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-indigo-300 hover:shadow-lg transition-all flex flex-col justify-between group">
      <div>
        {/* Header badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isClosed ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {t('voting.pollConcluded', { total: poll.totalRounds })}
              </span>
            ) : isRunoffActive ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-200">
                <Swords className="w-3 h-3" />
                {t('voting.roundN', { round: poll.currentRound })} ({t('common.runoffBadge')})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {t('voting.round1')}
              </span>
            )}

            {isCreator && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                {t('common.admin')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-slate-400 text-xs" title={poll.isPublicResult ? t('results.publicResultsBtn') : t('results.privateResultsBtn')}>
            {poll.isPublicResult ? (
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
          {poll.title}
        </h3>

        {poll.description && (
          <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
            {poll.description}
          </p>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0">
            {(poll.creatorDisplayName || 'U')[0]}
          </div>
          <span className="truncate max-w-[120px] text-slate-600 font-medium">
            {poll.creatorDisplayName || t('common.creator')}
          </span>
        </div>

        <Link
          to={`/poll/${poll.id}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 group-hover:translate-x-0.5 transition-all"
        >
          <span>{isClosed ? t('common.viewResults') : t('common.detailsAndVote')}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
