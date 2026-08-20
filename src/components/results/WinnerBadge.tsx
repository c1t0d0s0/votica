import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RoundResultSummary } from '../../lib/types';
import { Button } from '../common/Button';
import { Trophy, Swords, AlertTriangle, Sparkles } from 'lucide-react';

interface WinnerBadgeProps {
  summary: RoundResultSummary;
  isAdmin: boolean;
  onOpenRunoffModal?: () => void;
  isPollClosed?: boolean;
}

export const WinnerBadge: React.FC<WinnerBadgeProps> = ({
  summary,
  isAdmin,
  onOpenRunoffModal,
}) => {
  // Fire confetti if there is a definitive winner and poll or round has votes
  useEffect(() => {
    if (summary.winner && summary.totalVoters > 0 && !summary.hasTieForFirst) {
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.7 },
        });
      } catch {
        // Safe fail
      }
    }
  }, [summary.winner, summary.totalVoters, summary.hasTieForFirst]);

  // Case 1: Tie for 1st place
  if (summary.hasTieForFirst && summary.tiedFirstOptions.length > 1) {
    return (
      <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border-2 border-amber-300 dark:border-amber-700 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  同率1位検出
                </span>
                <span className="text-xs text-slate-500">
                  ({summary.tiedFirstOptions[0].votesCount}票獲得)
                </span>
              </div>
              <h4 className="text-base font-black text-slate-900 mt-1">
                {summary.tiedFirstOptions.map(t => `「${t.option.text}」`).join(' と ')} が同率1位です！
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                決着をつけるために、同率候補のみでの決選投票を実施することができます。
              </p>
            </div>
          </div>

          {isAdmin && onOpenRunoffModal && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenRunoffModal}
              leftIcon={<Swords className="w-4 h-4" />}
              className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-200 shrink-0 w-full sm:w-auto"
            >
              決選投票を開始
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Case 2: Clear Winner
  if (summary.winner) {
    return (
      <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-pink-500/10 to-amber-500/10 border-2 border-indigo-200 dark:border-indigo-800 shadow-md">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-200">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  第1位 確定候補
                </span>
                <span className="text-xs font-semibold text-indigo-700">
                  {summary.winner.votesCount} 票 ({summary.winner.percentage}%)
                </span>
              </div>
              <h4 className="text-lg font-black text-slate-900 mt-1">
                「{summary.winner.option.text}」
              </h4>
            </div>
          </div>

          {isAdmin && onOpenRunoffModal && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenRunoffModal}
              leftIcon={<Swords className="w-4 h-4 text-indigo-600" />}
              className="text-xs hidden md:inline-flex"
            >
              次の決選ラウンドを作成
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Case 3: No votes yet
  return null;
};
