import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../contexts/LanguageContext';
import {
  subscribePoll,
  subscribeRound,
  subscribeRoundVotes,
  subscribeAllRounds,
  updatePollVisibility,
  updateRoundStatus,
  updatePollStatus,
  updatePollVoterNamesVisibility,
} from '../lib/firestoreService';
import { Poll, PollRound, Vote, RoundResultSummary, ScheduleResultSummary } from '../lib/types';
import { calculateRoundResults } from '../lib/runoffUtils';
import { calculateScheduleResults } from '../lib/scheduleUtils';
import { ResultBarChart } from '../components/results/ResultBarChart';
import { WinnerBadge } from '../components/results/WinnerBadge';
import { ScheduleResultMatrix } from '../components/schedule/ScheduleResultMatrix';
import { RoundSelector } from '../components/results/RoundSelector';
import { RunoffWizardModal } from '../components/poll/RunoffWizardModal';
import { ShareModal } from '../components/poll/ShareModal';
import { DeletePollModal } from '../components/poll/DeletePollModal';
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
  CheckCircle2,
  Users,
  Trash2,
  Calendar,
} from 'lucide-react';

export const PollResultsPage: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [poll, setPoll] = useState<Poll | null>(null);
  const [allRounds, setAllRounds] = useState<PollRound[]>([]);
  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number>(1);
  const [currentRoundData, setCurrentRoundData] = useState<PollRound | null>(null);
  const [roundVotes, setRoundVotes] = useState<Vote[]>([]);
  const [summary, setSummary] = useState<RoundResultSummary | null>(null);
  const [scheduleSummary, setScheduleSummary] = useState<ScheduleResultSummary | null>(null);

  const [isRunoffModalOpen, setIsRunoffModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [isTogglingVoterNames, setIsTogglingVoterNames] = useState(false);
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

  const isScheduleMode = poll?.pollType === 'schedule';

  // Compute summary on round or votes update
  useEffect(() => {
    if (currentRoundData) {
      if (poll?.pollType === 'schedule') {
        setScheduleSummary(calculateScheduleResults(currentRoundData, roundVotes));
      } else {
        setSummary(calculateRoundResults(currentRoundData, roundVotes));
      }
    }
  }, [currentRoundData, roundVotes, poll?.pollType]);

  // Automatically mark poll as closed (決着・完了) when 1st place winner is confirmed (for standard poll)
  useEffect(() => {
    if (!poll || !currentRoundData || !summary || poll.pollType === 'schedule') return;
    if (poll.status === 'closed') return;
    if (currentRoundData.roundNumber !== poll.totalRounds) return;

    const isRoundEnded =
      currentRoundData.status === 'closed' ||
      Date.now() > new Date(currentRoundData.endDate).getTime();

    if (isRoundEnded && summary.winner && !summary.hasTieForFirst) {
      if (currentUser?.uid === poll.creatorUid) {
        updatePollStatus(poll.id, 'closed').catch(err =>
          console.warn('Auto-closing poll failed:', err)
        );
      }
    }
  }, [currentUser, poll, currentRoundData, summary]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-semibold text-slate-500">{t('results.loading')}</p>
      </div>
    );
  }

  if (!poll || !currentRoundData) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 mt-8 shadow-sm">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">{t('voting.pollNotFound')}</h2>
        <p className="text-xs text-slate-500 mt-2 mb-6">
          {t('voting.pollNotFoundDesc')}
        </p>
        <Link to="/">
          <Button variant="primary" size="sm">
            {t('common.backToHome')}
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
        <h2 className="text-xl font-bold text-slate-800">{t('results.privateTitle')}</h2>
        <p className="text-xs text-slate-500 mt-2 mb-6 leading-relaxed whitespace-pre-line">
          {t('results.privateDesc')}
        </p>
        <div className="flex justify-center gap-3">
          <Link to={`/poll/${poll.id}`}>
            <Button variant="primary" size="sm">
              {t('common.backToVote')}
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
      showToast('success', nextVal ? t('results.toastPublicSuccess') : t('results.toastPrivateSuccess'));
    } catch (err: any) {
      showToast('error', t('results.toastUpdateFailed') + (err.message || ''));
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  const handleToggleVoterNamesVisibility = async () => {
    if (!isAdmin) return;
    try {
      setIsTogglingVoterNames(true);
      const nextVal = !poll.showVoterNames;
      await updatePollVoterNamesVisibility(poll.id, nextVal);
      showToast(
        'success',
        nextVal
          ? t('results.toastVoterNamesShown')
          : t('results.toastVoterNamesHidden')
      );
    } catch (err: any) {
      showToast('error', t('results.toastUpdateFailed') + (err.message || ''));
    } finally {
      setIsTogglingVoterNames(false);
    }
  };

  const handleCloseRound = async () => {
    if (!isAdmin) return;
    if (window.confirm(t('results.confirmCloseRound'))) {
      try {
        await updateRoundStatus(poll.id, selectedRoundNumber, 'closed');
        showToast('info', t('results.toastCloseSuccess'));
      } catch (err: any) {
        showToast('error', t('results.toastUpdateFailed') + (err.message || ''));
      }
    }
  };

  const handleReopenRound = async () => {
    if (!isAdmin) return;
    try {
      await updateRoundStatus(poll.id, selectedRoundNumber, 'open');
      showToast('success', t('results.toastReopenSuccess'));
    } catch (err: any) {
      showToast('error', t('results.toastUpdateFailed') + (err.message || ''));
    }
  };

  const handleReopenPoll = async () => {
    if (!isAdmin) return;
    try {
      await updatePollStatus(poll.id, 'active');
      showToast('success', t('results.toastReopenPollSuccess'));
    } catch (err: any) {
      showToast('error', t('results.toastUpdateFailed') + (err.message || ''));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/poll/${poll.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('results.adminPanel') === '' ? '' : t('common.backToVote')}</span>
          </Link>

          {poll.status === 'closed' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {t('voting.pollConcluded', { total: poll.totalRounds })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsShareModalOpen(true)}
            leftIcon={<Share2 className="w-3.5 h-3.5" />}
          >
            {t('common.share')}
          </Button>

          <Link to={`/poll/${poll.id}`} className="shrink-0">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<VoteIcon className="w-3.5 h-3.5" />}
            >
              {t('common.vote')}
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
                {t('results.adminPanel')}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
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
                {poll.isPublicResult ? t('results.publicResultsBtn') : t('results.privateResultsBtn')}
              </Button>

              <Button
                variant={poll.showVoterNames ? 'success' : 'outline'}
                size="sm"
                onClick={handleToggleVoterNamesVisibility}
                isLoading={isTogglingVoterNames}
                leftIcon={<Users className="w-3.5 h-3.5" />}
                className={
                  poll.showVoterNames
                    ? 'bg-indigo-600 hover:bg-indigo-500 border-none text-white text-xs'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs'
                }
              >
                {poll.showVoterNames ? t('results.voterNamesVisibleBtn') : t('results.voterNamesHiddenBtn')}
              </Button>

              {summary?.hasTieForFirst && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsRunoffModalOpen(true)}
                  leftIcon={<Swords className="w-3.5 h-3.5" />}
                  className="bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 shadow-pink-500/20 text-xs"
                >
                  {t('results.startRunoffBtn')}
                </Button>
              )}

              <Button
                variant="danger"
                size="sm"
                onClick={() => setIsDeleteModalOpen(true)}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                className="bg-rose-700/90 hover:bg-rose-600 border border-rose-600/50 text-white text-xs"
              >
                {t('common.deletePoll')}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              {t('results.currentRoundLabel')} <span className="text-white font-bold">{currentRoundData.title}</span> (
              {currentRoundData.status === 'open' && Date.now() <= new Date(currentRoundData.endDate).getTime()
                ? t('results.statusOpen')
                : t('results.statusClosed')}
              )
            </div>

            <div className="flex items-center gap-3">
              {currentRoundData.status === 'open' && Date.now() <= new Date(currentRoundData.endDate).getTime() ? (
                <button
                  onClick={handleCloseRound}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold underline underline-offset-2"
                >
                  {t('results.closeRoundEarly')}
                </button>
              ) : (
                <button
                  onClick={handleReopenRound}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2"
                >
                  {t('results.reopenRound')}
                </button>
              )}

              {poll.status === 'closed' && (
                <button
                  onClick={handleReopenPoll}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2"
                >
                  {t('results.reopenPoll')}
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
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs font-black uppercase tracking-wider text-indigo-600">
              {isScheduleMode
                ? t('schedule.resultsTitle')
                : currentRoundData.title || t('results.resultsTitle', { round: currentRoundData.roundNumber })}
            </span>
            <span className="text-xs text-slate-400">{t('results.realtimeUpdate')}</span>
            {isScheduleMode ? (
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                <Calendar className="w-3 h-3 inline mr-1" />
                {t('schedule.badge')}
              </span>
            ) : poll.showVoterNames ? (
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                {t('results.namedVotingBadge')}
              </span>
            ) : (
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                {t('results.anonymousVotingBadge')}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {poll.title}
          </h1>
          {poll.description && (
            <p className="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-wrap">
              {poll.description}
            </p>
          )}
        </div>

        {isScheduleMode ? (
          /* Schedule Matrix Results */
          scheduleSummary && (
            <ScheduleResultMatrix
              poll={poll}
              round={currentRoundData}
              summary={scheduleSummary}
            />
          )
        ) : (
          /* Standard Voting Results */
          <>
            {/* Tie Detection / Winner Celebratory Banner */}
            {summary && (
              <WinnerBadge
                summary={summary}
                isAdmin={isAdmin}
                onOpenRunoffModal={() => setIsRunoffModalOpen(true)}
                isPollClosed={
                  poll.status === 'closed' ||
                  currentRoundData.status === 'closed' ||
                  Date.now() > new Date(currentRoundData.endDate).getTime()
                }
              />
            )}

            {/* Results Bar Chart */}
            {summary && <ResultBarChart summary={summary} showVoterNames={poll.showVoterNames} />}
          </>
        )}
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

      {/* Delete Modal */}
      <DeletePollModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        pollTitle={poll.title}
        pollId={poll.id}
        onSuccess={() => {
          navigate('/');
        }}
      />
    </div>
  );
};
