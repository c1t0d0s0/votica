import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../contexts/LanguageContext';
import { createPoll } from '../lib/firestoreService';
import { Poll, PollRound } from '../lib/types';
import {
  parseScheduleCandidateLines,
  candidateLinesToOptions,
} from '../lib/scheduleUtils';
import { ScheduleQuickDatePicker } from '../components/schedule/ScheduleQuickDatePicker';
import { Button } from '../components/common/Button';
import {
  Calendar,
  Sparkles,
  LogIn,
  AlertCircle,
  Clock,
  Lock,
  Globe,
  Vote as VoteIcon,
} from 'lucide-react';

export const CreateSchedulePage: React.FC = () => {
  const { currentUser, signInWithGoogle } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Default candidate dates text
  const [candidateText, setCandidateText] = useState<string>(() => {
    const d1 = new Date();
    d1.setDate(d1.getDate() + 1);
    const d2 = new Date();
    d2.setDate(d2.getDate() + 2);
    const d3 = new Date();
    d3.setDate(d3.getDate() + 3);

    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const fmt = (d: Date, time: string) =>
      `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]}) ${time}`;

    return `${fmt(d1, '19:00〜')}\n${fmt(d2, '19:00〜')}\n${fmt(d3, '19:00〜')}`;
  });

  // Default dates: start now, end 7 days later
  const now = new Date();
  const defaultEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const formatForInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  };

  const [startDate, setStartDate] = useState(formatForInput(now));
  const [endDate, setEndDate] = useState(formatForInput(defaultEnd));

  // Result visibility (default: true -> public to all participants)
  const [isPublicResult, setIsPublicResult] = useState<boolean>(true);

  // Authentication requirement (default: false -> anonymous/self-declared name for schedule adjustments)
  const [requireAuth, setRequireAuth] = useState<boolean>(false);

  // Show voter names (default: true -> named attendance sheet)
  const [showVoterNames, setShowVoterNames] = useState<boolean>(true);

  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedLines = parseScheduleCandidateLines(candidateText);

  const handleAddDatesFromPicker = (dates: string[]) => {
    const current = candidateText.trim();
    if (!current) {
      setCandidateText(dates.join('\n'));
    } else {
      setCandidateText(current + '\n' + dates.join('\n'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      showToast('error', t('create.toastLoginReq'));
      return;
    }

    if (!title.trim()) {
      showToast('error', t('schedule.toastTitleReq'));
      return;
    }

    if (parsedLines.length < 1) {
      showToast('error', t('schedule.toastMinCandidates'));
      return;
    }

    if (parsedLines.length > 30) {
      showToast('error', t('schedule.toastMaxCandidates'));
      return;
    }

    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = new Date(endDate).getTime();
    if (isNaN(startTimestamp) || isNaN(endTimestamp)) {
      showToast('error', t('create.toastInvalidDates'));
      return;
    }

    if (endTimestamp <= startTimestamp) {
      showToast('error', t('create.toastEndDateFuture'));
      return;
    }

    try {
      setIsSubmitting(true);

      const options = candidateLinesToOptions(parsedLines);

      const pollData: Omit<Poll, 'id' | 'createdAt' | 'updatedAt' | 'currentRound' | 'totalRounds'> = {
        title: title.trim(),
        description: description.trim(),
        creatorUid: currentUser.uid,
        creatorDisplayName: currentUser.displayName || t('create.defaultCreatorName'),
        creatorEmail: currentUser.email || undefined,
        creatorPhotoURL: currentUser.photoURL || undefined,
        status: 'active',
        isPublicResult,
        requireAuth,
        showVoterNames,
        pollType: 'schedule',
      };

      const initialRound: Omit<PollRound, 'roundNumber'> = {
        title: t('schedule.defaultRoundTitle'),
        description: description.trim() || undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        maxChoices: options.length,
        options,
        status: 'open',
        candidateSource: 'manual',
      };

      const pollId = await createPoll(pollData, initialRound);
      showToast('success', t('schedule.toastSuccess'));
      navigate(`/poll/${pollId}`);
    } catch (err: any) {
      console.error('Failed to create schedule poll:', err);
      showToast('error', t('create.toastFailed') + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Mode Switch Tabs at Top */}
      <div className="flex items-center gap-2 mb-6 p-1 rounded-2xl bg-slate-100 border border-slate-200 w-full sm:w-fit">
        <Link
          to="/create"
          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <VoteIcon className="w-3.5 h-3.5" />
          <span>{t('schedule.tabStandardPoll')}</span>
        </Link>
        <button
          type="button"
          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white text-indigo-600 shadow-xs cursor-default"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>{t('schedule.tabScheduleAdjust')}</span>
        </button>
      </div>

      {/* Page Header */}
      <div className="mb-8 text-center sm:text-left">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t('schedule.createBadge')}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {t('schedule.createTitle')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {t('schedule.createSubtitle')}
        </p>
      </div>

      {/* Login reminder if not logged in */}
      {!currentUser && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs text-amber-900">
              <span className="font-bold">{t('create.loginRequiredTitle')}</span>
              <p className="text-amber-700 mt-0.5">
                {t('create.loginRequiredDesc')}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={signInWithGoogle}
            leftIcon={<LogIn className="w-4 h-4" />}
            className="shrink-0 w-full sm:w-auto"
          >
            {t('create.loginButton')}
          </Button>
        </div>
      )}

      {/* Main Creation Form */}
      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
        {/* Section 1: Event Information */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>{t('schedule.eventInfoTitle')}</span>
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('schedule.eventTitleLabel')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('schedule.eventTitlePlaceholder')}
              className="w-full text-sm sm:text-base px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition-all shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('schedule.eventDescLabel')}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('schedule.eventDescPlaceholder')}
              className="w-full text-xs sm:text-sm px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Section 2: Candidate Dates Input */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>{t('schedule.candidateDatesTitle')}</span>
            </h3>
            <span className="text-xs font-bold text-indigo-600">
              {t('schedule.candidateCount', { count: parsedLines.length })}
            </span>
          </div>

          {/* Quick Date Picker / Preset Helper */}
          <ScheduleQuickDatePicker onAddDates={handleAddDatesFromPicker} />

          {/* Multiline textarea for dates */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('schedule.candidateTextareaLabel')} <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={6}
              required
              value={candidateText}
              onChange={e => setCandidateText(e.target.value)}
              placeholder={t('schedule.candidateTextareaPlaceholder')}
              className="w-full font-mono text-xs sm:text-sm px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed shadow-sm"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              {t('schedule.candidateTextareaHint')}
            </p>
          </div>
        </div>

        {/* Section 3: Deadline & Advanced Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-600" />
              <span>{t('schedule.settingsTitle')}</span>
            </h3>

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
            >
              {showAdvanced ? t('schedule.hideAdvanced') : t('schedule.showAdvanced')}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {t('create.endDate')} (回答締め切り) <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {t('create.startDate')}
              </label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm"
              />
            </div>
          </div>

          {/* Advanced options toggle */}
          {showAdvanced && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              {/* Login Requirement Setting */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  {t('create.voterAuth')}
                </label>
                <div
                  onClick={() => setRequireAuth(!requireAuth)}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition-all cursor-pointer flex items-start gap-3.5 select-none"
                >
                  <input
                    type="checkbox"
                    id="schedNoLoginCheckbox"
                    checked={!requireAuth}
                    onChange={e => setRequireAuth(!e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="flex-1 text-xs">
                    <label
                      htmlFor="schedNoLoginCheckbox"
                      className="font-bold text-slate-900 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{t('create.noLoginCheckbox')}</span>
                    </label>
                    <p className="text-slate-500 mt-1 leading-relaxed">
                      {t('schedule.noLoginDesc')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Voter Names Breakdown Setting */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  {t('create.voterNamesVisibility')}
                </label>
                <div
                  onClick={() => setShowVoterNames(!showVoterNames)}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition-all cursor-pointer flex items-start gap-3.5 select-none"
                >
                  <input
                    type="checkbox"
                    id="schedShowVoterNamesCheckbox"
                    checked={showVoterNames}
                    onChange={e => setShowVoterNames(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="flex-1 text-xs">
                    <label
                      htmlFor="schedShowVoterNamesCheckbox"
                      className="font-bold text-slate-900 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{t('schedule.showAttendanceNamesCheckbox')}</span>
                    </label>
                    <p className="text-slate-500 mt-1 leading-relaxed">
                      {t('schedule.showAttendanceNamesDesc')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Result Visibility */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  {t('create.resultVisibility')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setIsPublicResult(true)}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      isPublicResult
                        ? 'border-indigo-600 bg-indigo-50/60 font-semibold shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-900">
                      <Globe className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold">{t('schedule.publicAttendanceTitle')}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {t('schedule.publicAttendanceDesc')}
                    </p>
                  </div>

                  <div
                    onClick={() => setIsPublicResult(false)}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      !isPublicResult
                        ? 'border-indigo-600 bg-indigo-50/60 font-semibold shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-900">
                      <Lock className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold">{t('create.adminOnlyTitle')}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {t('create.adminOnlyDesc')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit action */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-slate-400 text-center sm:text-left">
            {t('schedule.footerNote')}
          </span>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            disabled={!currentUser}
            className="w-full sm:w-auto px-8 shadow-md"
          >
            {t('schedule.submitBtn')}
          </Button>
        </div>
      </form>
    </div>
  );
};
