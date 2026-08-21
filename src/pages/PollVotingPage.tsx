import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../contexts/LanguageContext';
import {
  subscribePoll,
  subscribeRound,
  subscribeUserVote,
  subscribeRoundVotes,
  subscribeAllRounds,
  castVote,
  updatePollStatus,
} from '../lib/firestoreService';
import { Poll, PollRound, Vote, RoundResultSummary, ScheduleChoice, ScheduleResultSummary } from '../lib/types';
import { calculateRoundResults } from '../lib/runoffUtils';
import { calculateScheduleResults } from '../lib/scheduleUtils';
import { VoteOptionCard } from '../components/poll/VoteOptionCard';
import { ScheduleVotingTable } from '../components/schedule/ScheduleVotingTable';
import { ScheduleResultMatrix } from '../components/schedule/ScheduleResultMatrix';
import { CountdownTimer } from '../components/poll/CountdownTimer';
import { ShareModal } from '../components/poll/ShareModal';
import { RunoffWizardModal } from '../components/poll/RunoffWizardModal';
import { DeletePollModal } from '../components/poll/DeletePollModal';
import { RoundSelector } from '../components/results/RoundSelector';
import { Button } from '../components/common/Button';
import {
  Vote as VoteIcon,
  Swords,
  Share2,
  BarChart3,
  CheckCircle2,
  LogIn,
  AlertCircle,
  AlertTriangle,
  Trophy,
  Layers,
  ShieldCheck,
  Globe,
  Trash2,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const PollVotingPage: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const { currentUser, signInWithGoogle } = useAuth();
  const { showToast } = useToast();
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  const [poll, setPoll] = useState<Poll | null>(null);
  const [allRounds, setAllRounds] = useState<PollRound[]>([]);
  const [viewRoundNumber, setViewRoundNumber] = useState<number>(1);
  const [currentRoundData, setCurrentRoundData] = useState<PollRound | null>(null);
  const [userVote, setUserVote] = useState<Vote | null>(null);
  const [roundVotes, setRoundVotes] = useState<Vote[]>([]);
  const [summary, setSummary] = useState<RoundResultSummary | null>(null);

  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [scheduleResponses, setScheduleResponses] = useState<Record<string, ScheduleChoice>>({});
  const [scheduleComment, setScheduleComment] = useState<string>('');
  const [scheduleSummary, setScheduleSummary] = useState<ScheduleResultSummary | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isRunoffModalOpen, setIsRunoffModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pollLoading, setPollLoading] = useState(true);

  // Self-declared nickname and persistent anonymous device ID for no-login polls
  const [anonName, setAnonName] = useState<string>(() => {
    try {
      return localStorage.getItem('votica_anon_name') || '';
    } catch {
      return '';
    }
  });

  const [anonUid] = useState<string>(() => {
    try {
      let uid = localStorage.getItem('votica_anon_uid');
      if (!uid) {
        uid = 'anon_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
        localStorage.setItem('votica_anon_uid', uid);
      }
      return uid;
    } catch {
      return 'anon_' + Math.random().toString(36).substring(2, 9);
    }
  });

  // Live timer tick so deadline triggers immediately
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe to poll
  useEffect(() => {
    if (!pollId) return;
    setPollLoading(true);

    const unsubPoll = subscribePoll(pollId, p => {
      setPoll(p);
      if (p) {
        setViewRoundNumber(p.currentRound);
      }
      setPollLoading(false);
    });

    const unsubAllRounds = subscribeAllRounds(pollId, rounds => {
      setAllRounds(rounds);
    });

    return () => {
      unsubPoll();
      unsubAllRounds();
    };
  }, [pollId]);

  // Subscribe to the selected view round
  useEffect(() => {
    if (!pollId || !viewRoundNumber) return;

    const unsubRound = subscribeRound(pollId, viewRoundNumber, r => {
      setCurrentRoundData(r);
    });

    const unsubVotes = subscribeRoundVotes(pollId, viewRoundNumber, votes => {
      setRoundVotes(votes);
    });

    return () => {
      unsubRound();
      unsubVotes();
    };
  }, [pollId, viewRoundNumber]);

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

  // Effective User ID (Google Auth UID or Anonymous UID if login is not required)
  const isAnonymousAllowed = poll?.requireAuth === false;
  const effectiveUserId = currentUser?.uid || (isAnonymousAllowed ? anonUid : undefined);

  // Subscribe to the current user's vote in this view round
  useEffect(() => {
    if (!pollId || !viewRoundNumber || !effectiveUserId) {
      setUserVote(null);
      setSelectedOptionIds([]);
      setScheduleResponses({});
      setScheduleComment('');
      return;
    }

    const unsubUserVote = subscribeUserVote(pollId, viewRoundNumber, effectiveUserId, v => {
      setUserVote(v);
      if (v) {
        setSelectedOptionIds(v.selectedOptionIds || []);
        if (v.scheduleResponses) {
          setScheduleResponses(v.scheduleResponses);
        } else if (v.selectedOptionIds && currentRoundData) {
          const resp: Record<string, ScheduleChoice> = {};
          currentRoundData.options.forEach(opt => {
            resp[opt.id] = v.selectedOptionIds.includes(opt.id) ? 'circle' : 'cross';
          });
          setScheduleResponses(resp);
        }
        if (v.comment) {
          setScheduleComment(v.comment);
        }
        if (v.userDisplayName && !anonName) {
          setAnonName(v.userDisplayName);
        }
      } else {
        setSelectedOptionIds([]);
        // Default initialize schedule responses with empty or undefined
        setScheduleResponses({});
        setScheduleComment('');
      }
    });

    return () => unsubUserVote();
  }, [pollId, viewRoundNumber, effectiveUserId, currentRoundData]);

  if (pollLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-semibold text-slate-500">{t('voting.pollLoading')}</p>
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
  const isSingleChoice = currentRoundData.maxChoices === 1;

  const startMs = new Date(currentRoundData.startDate).getTime();
  const endMs = new Date(currentRoundData.endDate).getTime();
  const isVotingOpen = nowMs >= startMs && nowMs <= endMs && currentRoundData.status === 'open';
  const isVotingScheduled = nowMs < startMs;
  const isVotingClosed = nowMs > endMs || currentRoundData.status === 'closed';

  // Handle choice toggle for standard poll
  const handleToggleOption = (optionId: string) => {
    if (!isVotingOpen) return;

    if (isSingleChoice) {
      setSelectedOptionIds([optionId]);
      return;
    }

    if (selectedOptionIds.includes(optionId)) {
      setSelectedOptionIds(prev => prev.filter(id => id !== optionId));
    } else {
      if (selectedOptionIds.length >= currentRoundData.maxChoices) {
        showToast('warning', t('voting.toastMaxChoicesExceeded', { max: currentRoundData.maxChoices }));
        return;
      }
      setSelectedOptionIds(prev => [...prev, optionId]);
    }
  };

  // Handle schedule response change
  const handleScheduleResponseChange = (optionId: string, choice: ScheduleChoice) => {
    if (!isVotingOpen) return;
    setScheduleResponses(prev => ({
      ...prev,
      [optionId]: choice,
    }));
  };

  // Handle schedule batch set all
  const handleScheduleSetAll = (choice: ScheduleChoice) => {
    if (!isVotingOpen || !currentRoundData) return;
    const next: Record<string, ScheduleChoice> = {};
    currentRoundData.options.forEach(opt => {
      next[opt.id] = choice;
    });
    setScheduleResponses(next);
  };

  // Submit Vote (Handles both standard poll and schedule adjustment)
  const handleVoteSubmit = async () => {
    if (!currentUser && !isAnonymousAllowed) {
      showToast('error', t('voting.toastLoginRequired'));
      return;
    }

    if (!currentUser && isAnonymousAllowed) {
      if (!anonName.trim()) {
        showToast('error', t('voting.toastNameRequired'));
        return;
      }
      try {
        localStorage.setItem('votica_anon_name', anonName.trim());
      } catch {}
    }

    if (!isVotingOpen) {
      showToast('error', t('voting.toastVotingClosed'));
      return;
    }

    if (isScheduleMode) {
      // For schedule adjustment, check if at least one candidate has been responded to
      const answeredKeys = Object.keys(scheduleResponses);
      if (answeredKeys.length === 0) {
        showToast('error', t('schedule.toastSelectAttendance'));
        return;
      }

      try {
        setIsSubmitting(true);
        const voterUid = currentUser ? currentUser.uid : anonUid;
        const voterName = currentUser
          ? currentUser.displayName || t('common.googleUser')
          : anonName.trim();

        // Selected option IDs as circles for compatibility
        const circleOptionIds = Object.entries(scheduleResponses)
          .filter(([_, choice]) => choice === 'circle')
          .map(([id]) => id);

        const votePayload: Omit<Vote, 'id' | 'votedAt'> = {
          userId: voterUid,
          userDisplayName: voterName,
          selectedOptionIds: circleOptionIds,
          scheduleResponses,
          comment: scheduleComment.trim() || undefined,
        };

        if (currentUser?.photoURL) {
          votePayload.userPhotoURL = currentUser.photoURL;
        }

        await castVote(poll.id, viewRoundNumber, votePayload);

        // Confetti feedback
        try {
          confetti({
            particleCount: 60,
            spread: 50,
            origin: { y: 0.6 },
          });
        } catch {}

        showToast('success', userVote ? t('voting.toastVoteUpdated') : t('voting.toastVoteSuccess'));
      } catch (err: any) {
        console.error('Schedule vote failed:', err);
        showToast('error', t('voting.toastVoteFailed') + (err.message || ''));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Standard poll voting submission
    if (selectedOptionIds.length === 0) {
      showToast('error', t('voting.toastSelectOption'));
      return;
    }

    if (selectedOptionIds.length > currentRoundData.maxChoices) {
      showToast('error', t('voting.toastMaxChoicesExceeded', { max: currentRoundData.maxChoices }));
      return;
    }

    try {
      setIsSubmitting(true);
      const voterUid = currentUser ? currentUser.uid : anonUid;
      const voterName = currentUser
        ? currentUser.displayName || t('common.googleUser')
        : anonName.trim();
      const votePayload: Omit<Vote, 'id' | 'votedAt'> = {
        userId: voterUid,
        userDisplayName: voterName,
        selectedOptionIds,
      };
      if (currentUser?.photoURL) {
        votePayload.userPhotoURL = currentUser.photoURL;
      }

      await castVote(poll.id, viewRoundNumber, votePayload);

      // Confetti feedback
      try {
        confetti({
          particleCount: 60,
          spread: 50,
          origin: { y: 0.6 },
        });
      } catch {}

      showToast('success', userVote ? t('voting.toastVoteUpdated') : t('voting.toastVoteSuccess'));
    } catch (err: any) {
      console.error('Vote failed:', err);
      showToast('error', t('voting.toastVoteFailed') + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Navigation & Round Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          {isScheduleMode ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Calendar className="w-3.5 h-3.5" />
              <span>{t('schedule.badge')}</span>
            </span>
          ) : poll.status === 'closed' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {t('voting.pollConcluded', { total: poll.totalRounds })}
            </span>
          ) : poll.totalRounds > 1 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-pink-100 text-pink-800 border border-pink-200">
              <Swords className="w-3.5 h-3.5 text-pink-600" />
              {t('voting.runoffInProgress', { round: poll.currentRound, total: poll.totalRounds })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              <VoteIcon className="w-3.5 h-3.5" />
              {t('voting.round1')}
            </span>
          )}

          {isAnonymousAllowed ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Globe className="w-3 h-3 text-emerald-600" />
              {t('voting.noLoginAllowed')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              <ShieldCheck className="w-3 h-3 text-slate-500" />
              {t('voting.loginRequired')}
            </span>
          )}

          {isAdmin && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
              {t('voting.adminBadge')}
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
            {t('voting.shareBtn')}
          </Button>

          {(isAdmin || poll.isPublicResult) && (
            <Link to={`/poll/${poll.id}/results`} className="shrink-0">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<BarChart3 className="w-3.5 h-3.5 text-indigo-400" />}
              >
                {isAdmin ? t('voting.adminResultsBtn') : t('voting.resultsBtn')}
              </Button>
            </Link>
          )}

          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteModalOpen(true)}
              leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
              className="text-rose-600 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700"
            >
              {t('common.delete')}
            </Button>
          )}
        </div>
      </div>

      {/* Multi-round Switcher if multiple rounds exist */}
      {allRounds.length > 1 && (
        <RoundSelector
          rounds={allRounds}
          selectedRoundNumber={viewRoundNumber}
          currentActiveRoundNumber={poll.currentRound}
          onSelectRound={setViewRoundNumber}
        />
      )}

      {/* Poll Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black uppercase tracking-wider text-indigo-600">
              {isScheduleMode
                ? t('schedule.scheduleHeaderBadge')
                : currentRoundData.title || t('voting.roundN', { round: currentRoundData.roundNumber })}
            </span>
            {currentRoundData.runoffSourceRound && (
              <span className="text-[11px] text-pink-600 bg-pink-50 px-2 py-0.5 rounded-md font-medium">
                {t('voting.runoffFromRound', { round: currentRoundData.runoffSourceRound })}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
            {poll.title}
          </h1>

          {poll.description && (
            <p className="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-wrap">
              {poll.description}
            </p>
          )}
        </div>

        {/* Voting Status & Countdown */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <CountdownTimer
            startDate={currentRoundData.startDate}
            endDate={currentRoundData.endDate}
          />

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            {isScheduleMode ? (
              <span>{t('schedule.choicesGuide')}</span>
            ) : (
              <>
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {isSingleChoice
                    ? t('voting.singleChoiceHint')
                    : t('voting.multiChoiceHint', { max: currentRoundData.maxChoices })}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Round Status Banner when Closed or Progressing (Standard Poll) */}
      {!isScheduleMode && isVotingClosed && (
        <>
          {poll.totalRounds > viewRoundNumber ? (
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-indigo-950">
              <div className="flex items-center gap-2.5 text-xs font-semibold">
                <Swords className="w-4 h-4 text-pink-600 shrink-0" />
                <span>
                  {t('voting.roundEndedRunoffActive', { round: viewRoundNumber, current: poll.currentRound })}
                </span>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setViewRoundNumber(poll.currentRound)}
                className="shrink-0 text-xs w-full sm:w-auto"
              >
                {t('voting.goToCurrentRunoff', { round: poll.currentRound })}
              </Button>
            </div>
          ) : summary?.hasTieForFirst ? (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950">
              <div className="flex items-start sm:items-center gap-2.5 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  {t('voting.tieDetectedMsg', {
                    names: summary.tiedFirstOptions.map(tOpt => `「${tOpt.option.text}」`).join(language === 'ja' ? ' と ' : ' & ')
                  })}
                  {!isAdmin ? t('voting.tieWaitAdmin') : t('voting.tieStartAdmin')}
                </span>
              </div>
              {isAdmin && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsRunoffModalOpen(true)}
                  leftIcon={<Swords className="w-4 h-4" />}
                  className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-200 shrink-0 text-xs w-full sm:w-auto"
                >
                  {t('voting.startRunoffBtn')}
                </Button>
              )}
            </div>
          ) : summary?.winner ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-emerald-950">
              <div className="flex items-center gap-2.5 text-xs font-semibold">
                <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  {t('voting.winnerDetectedMsg', {
                    name: summary.winner.option.text,
                    votes: summary.winner.votesCount,
                  })}
                </span>
              </div>
              {(isAdmin || poll.isPublicResult) && (
                <Link to={`/poll/${poll.id}/results`}>
                  <Button variant="outline" size="sm" className="shrink-0 text-xs">
                    {t('voting.viewDetailResults')}
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-600 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{t('voting.votingClosedBanner')}</span>
            </div>
          )}
        </>
      )}

      {/* Voting / Response Input Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            {isScheduleMode ? (
              <>
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>{t('schedule.votingSectionTitle')}</span>
              </>
            ) : (
              <>
                <span>{t('voting.optionsTitle')}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {t('voting.totalOptionsCount', { count: currentRoundData.options.length })}
                </span>
              </>
            )}
          </h3>

          {!isScheduleMode && !isSingleChoice && isVotingOpen && (
            <span className="text-xs font-bold text-indigo-600">
              {t('voting.selectedOptionsCount', {
                selected: selectedOptionIds.length,
                max: currentRoundData.maxChoices,
              })}
            </span>
          )}
        </div>

        {isScheduleMode ? (
          /* Schedule Attendance Voting UI */
          <ScheduleVotingTable
            options={currentRoundData.options}
            responses={scheduleResponses}
            onChangeResponse={handleScheduleResponseChange}
            onSetAllResponses={handleScheduleSetAll}
            disabled={!isVotingOpen}
          />
        ) : (
          /* Standard Options List */
          <div className="grid grid-cols-1 gap-3">
            {currentRoundData.options.map((option, index) => {
              const isSelected = selectedOptionIds.includes(option.id);
              const isDisabled =
                !isVotingOpen ||
                (!isSelected &&
                  !isSingleChoice &&
                  selectedOptionIds.length >= currentRoundData.maxChoices);

              return (
                <VoteOptionCard
                  key={option.id}
                  option={option}
                  index={index}
                  isSelected={isSelected}
                  isSingleChoice={isSingleChoice}
                  isDisabled={isDisabled}
                  onToggle={handleToggleOption}
                />
              );
            })}
          </div>
        )}

        {/* Schedule Comment Input */}
        {isScheduleMode && isVotingOpen && (
          <div className="pt-3 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
              <span>{t('schedule.commentLabel')}</span>
              <span className="text-[11px] text-slate-400 font-normal">({t('schedule.optional')})</span>
            </label>
            <input
              type="text"
              value={scheduleComment}
              onChange={e => setScheduleComment(e.target.value)}
              placeholder={t('schedule.commentPlaceholder')}
              className="w-full text-xs sm:text-sm px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-2xs"
            />
          </div>
        )}
      </div>

      {/* Action Footer & User State (Sticky bar) */}
      <div className="sticky bottom-4 z-30 bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* User state indicator / Name Input */}
        <div className="text-xs text-slate-600 w-full sm:w-auto text-center sm:text-left">
          {currentUser ? (
            <div>
              <span className="font-semibold text-slate-900">
                {t('voting.loggedInAs', { name: currentUser.displayName || t('common.user') })}
              </span>
              {userVote && (
                <div className="flex items-center gap-1.5 text-emerald-600 font-bold mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {isScheduleMode
                      ? t('schedule.alreadyResponded')
                      : t('voting.votedInRound', { count: userVote.selectedOptionIds.length })}
                  </span>
                </div>
              )}
            </div>
          ) : isAnonymousAllowed ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
              <div className="w-full sm:w-60 text-left">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t('voting.anonNameLabel')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={anonName}
                  onChange={e => {
                    setAnonName(e.target.value);
                    try {
                      localStorage.setItem('votica_anon_name', e.target.value);
                    } catch {}
                  }}
                  placeholder={t('voting.anonNamePlaceholder')}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm font-medium"
                />
              </div>
              {userVote && (
                <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {isScheduleMode
                      ? t('schedule.alreadyResponded')
                      : t('voting.anonVoted', { count: userVote.selectedOptionIds.length })}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{t('voting.googleLoginPrompt')}</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="w-full sm:w-auto flex items-center gap-2">
          {currentUser || isAnonymousAllowed ? (
            <Button
              variant={userVote ? 'secondary' : 'primary'}
              size="lg"
              onClick={handleVoteSubmit}
              isLoading={isSubmitting}
              disabled={
                !isVotingOpen ||
                (isScheduleMode
                  ? Object.keys(scheduleResponses).length === 0
                  : selectedOptionIds.length === 0) ||
                (!currentUser && !anonName.trim())
              }
              className="w-full sm:w-auto px-8 shadow-md"
            >
              {isVotingClosed
                ? t('voting.statusClosed')
                : isVotingScheduled
                ? t('voting.statusScheduled')
                : userVote
                ? isScheduleMode
                  ? t('schedule.btnUpdateResponse')
                  : t('voting.btnUpdateVote')
                : isScheduleMode
                ? t('schedule.btnSubmitResponse')
                : t('voting.btnSubmitVote')}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={signInWithGoogle}
              leftIcon={<LogIn className="w-4 h-4" />}
              className="w-full sm:w-auto px-8"
            >
              {t('voting.btnSignInAndVote')}
            </Button>
          )}
        </div>
      </div>

      {/* Realtime Attendance Matrix Table for Schedule Mode (Chouseisan Style) */}
      {isScheduleMode && scheduleSummary && (poll.isPublicResult || isAdmin) && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <ScheduleResultMatrix
            poll={poll}
            round={currentRoundData}
            summary={scheduleSummary}
          />
        </div>
      )}

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
            setViewRoundNumber(newRoundNumber);
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
