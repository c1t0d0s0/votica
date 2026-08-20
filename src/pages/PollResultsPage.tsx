import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  subscribePoll,
  subscribeRound,
  subscribeRoundVotes,
  subscribeAllRounds,
  updatePollVisibility,
  updateRoundStatus,
} from '../lib/firestoreService';
import { Poll, PollRound, Vote, RoundResultSummary } from '../lib/types';
import { calculateRoundResults } from '../lib/runoffUtils';
import { ResultBarChart } from '../components/results/ResultBarChart';
import { WinnerBadge } from '../components/results/WinnerBadge';
import { RoundSelector } from '../components/results/RoundSelector';
import { RunoffWizardModal } from '../components/poll/RunoffWizardModal';
import { ShareModal } from '../components/poll/ShareModal';
import { Button } from '../components/common/Button';
import {
  Swords,
  Lock,
  Globe,
  Share2,
  ArrowLeft,
  Shield,
  AlertCircle,
  Vote as VoteIcon,
} from 'lucide-react';

export const PollResultsPage: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [poll, setPoll] = useState<Poll | null>(null);
  const [allRounds, setAllRounds] = useState<PollRound[]>([]);
  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number>(1);
  const [currentRoundData, setCurrentRoundData] = useState<PollRound | null>(null);
  const [roundVotes, setRoundVotes] = useState<Vote[]>([]);
  const [summary, setSummary] = useState<RoundResultSummary | null>(null);

  const [isRunoffModalOpen, setIsRunoffModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [loading, setLoading] = useState(true);

  // Subscribe to poll
  useEffect(() => {
    if (!pollId) return;
    setLoading(true);

    const unsubPoll = subscribePoll(pollId, p => {
      setPoll(p);
      if (p) {
        setSelectedRoundNumber(p.currentRound);
      }
      setLoading(false);
    });

    const unsubAllRounds = subscribeAllRounds(pollId, rounds => {
      setAllRounds(rounds);
    });

    return () => {
      unsubPoll();
      unsubAllRounds();
    };
  }, [pollId]);

  // Subscribe to selected round
  useEffect(() => {
    if (!pollId || !selectedRoundNumber) return;

    const unsubRound = subscribeRound(pollId, selectedRoundNumber, r => {
      setCurrentRoundData(r);
    });

    const unsubVotes = subscribeRoundVotes(pollId, selectedRoundNumber, votes => {
      setRoundVotes(votes);
    });

    return () => {
      unsubRound();
      unsubVotes();
    };
  }, [pollId, selectedRoundNumber]);

  // Calculate results on votes / round change
  useEffect(() => {
    if (currentRoundData) {
      const res = calculateRoundResults(currentRoundData, roundVotes);
      setSummary(res);
    }
  }, [currentRoundData, roundVotes]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-semibold text-slate-500">集計結果を読み込み中...</p>
      </div>
    );
  }

  if (!poll || !currentRoundData) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 mt-8 shadow-sm">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">投票が見つかりませんでした</h2>
        <p className="text-xs text-slate-500 mt-2 mb-6">
          指定されたIDの投票データが存在しないか、非公開に設定されています。
        </p>
        <Link to="/">
          <Button variant="primary" size="sm">
            トップページへ戻る
          </Button>
        </Link>
      </div>
    );
  }

  const isAdmin = currentUser?.uid === poll.creatorUid;

  // Access check: only admin can view if isPublicResult is false
  if (!isAdmin && !poll.isPublicResult) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 mt-8 shadow-sm">
        <Lock className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">結果は非公開です</h2>
        <p className="text-xs text-slate-500 mt-2 mb-6 leading-relaxed">
          この投票の集計結果は管理者のみに限定されています。
          <br />
          管理者が結果を公開すると、こちらで閲覧できるようになります。
        </p>
        <div className="flex justify-center gap-3">
          <Link to={`/poll/${poll.id}`}>
            <Button variant="primary" size="sm">
              投票ページへ戻る
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleToggleVisibility = async () => {
    if (!isAdmin) return;
    try {
      setIsTogglingVisibility(true);
      const nextVal = !poll.isPublicResult;
      await updatePollVisibility(poll.id, nextVal);
      showToast('success', nextVal ? '結果を全員に公開しました！' : '結果を非公開（管理者のみ）にしました');
    } catch (err: any) {
      showToast('error', '公開設定の更新に失敗しました: ' + (err.message || ''));
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  const handleCloseRound = async () => {
    if (!isAdmin) return;
    if (window.confirm('このラウンドの投票受付を即時終了しますか？')) {
      try {
        await updateRoundStatus(poll.id, selectedRoundNumber, 'closed');
        showToast('info', '投票受付を終了しました');
      } catch (err: any) {
        showToast('error', 'ステータス更新に失敗しました: ' + (err.message || ''));
      }
    }
  };

  const handleReopenRound = async () => {
    if (!isAdmin) return;
    try {
      await updateRoundStatus(poll.id, selectedRoundNumber, 'open');
      showToast('success', '投票受付を再開しました');
    } catch (err: any) {
      showToast('error', 'ステータス更新に失敗しました: ' + (err.message || ''));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <Link
          to={`/poll/${poll.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>投票ページへ戻る</span>
        </Link>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsShareModalOpen(true)}
            leftIcon={<Share2 className="w-3.5 h-3.5" />}
          >
            共有
          </Button>

          <Link to={`/poll/${poll.id}`}>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<VoteIcon className="w-3.5 h-3.5" />}
            >
              投票する
            </Button>
          </Link>
        </div>
      </div>

      {/* Admin Control Panel Banner (Visible only to Creator) */}
      {isAdmin && (
        <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                管理者コントロールパネル
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={poll.isPublicResult ? 'success' : 'outline'}
                size="sm"
                onClick={handleToggleVisibility}
                isLoading={isTogglingVisibility}
                leftIcon={poll.isPublicResult ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                className={
                  poll.isPublicResult
                    ? 'bg-emerald-600 hover:bg-emerald-500 border-none text-white text-xs'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs'
                }
              >
                {poll.isPublicResult ? '結果公開中 (全体公開)' : '結果非公開 (管理者のみ)'}
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsRunoffModalOpen(true)}
                leftIcon={<Swords className="w-3.5 h-3.5" />}
                className="bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 shadow-pink-500/20 text-xs"
              >
                決選投票を開始
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              現在のラウンド: <span className="text-white font-bold">{currentRoundData.title}</span> (
              {currentRoundData.status === 'open' ? '受付中' : '終了'})
            </div>

            <div className="flex items-center gap-2">
              {currentRoundData.status === 'open' ? (
                <button
                  onClick={handleCloseRound}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold underline underline-offset-2"
                >
                  このラウンドを早期終了する
                </button>
              ) : (
                <button
                  onClick={handleReopenRound}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2"
                >
                  投票受付を再開する
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Multi-round switcher */}
      {allRounds.length > 1 && (
        <RoundSelector
          rounds={allRounds}
          selectedRoundNumber={selectedRoundNumber}
          currentActiveRoundNumber={poll.currentRound}
          onSelectRound={setSelectedRoundNumber}
        />
      )}

      {/* Main Results Container */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-indigo-600">
              {currentRoundData.title || `第${currentRoundData.roundNumber}回 集計結果`}
            </span>
            <span className="text-xs text-slate-400">• リアルタイム更新</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {poll.title}
          </h1>
        </div>

        {/* Tie Detection / Winner Celebratory Banner */}
        {summary && (
          <WinnerBadge
            summary={summary}
            isAdmin={isAdmin}
            onOpenRunoffModal={() => setIsRunoffModalOpen(true)}
            isPollClosed={currentRoundData.status === 'closed'}
          />
        )}

        {/* Results Bar Chart */}
        {summary && <ResultBarChart summary={summary} />}
      </div>

      {/* Runoff Wizard Modal */}
      {summary && (
        <RunoffWizardModal
          isOpen={isRunoffModalOpen}
          onClose={() => setIsRunoffModalOpen(false)}
          pollId={poll.id}
          previousRound={currentRoundData}
          summary={summary}
          nextRoundNumber={allRounds.length + 1}
          onSuccess={newRoundNumber => {
            setSelectedRoundNumber(newRoundNumber);
            navigate(`/poll/${poll.id}`);
          }}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        pollTitle={poll.title}
        pollId={poll.id}
      />
    </div>
  );
};
