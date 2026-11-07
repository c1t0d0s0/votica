import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../contexts/LanguageContext';
import { createPoll, normalizeEventInfo } from '../lib/firestoreService';
import { Poll, PollRound } from '../lib/types';
import {
  candidateLinesToOptions,
  sanitizeHttpUrl,
  sortScheduleOptions,
  normalizeCapacity,
  MAX_SCHEDULE_CANDIDATES,
} from '../lib/scheduleUtils';
import {
  CandidateDraft,
  changeDraftTime,
  duplicateDraftWithNewTime,
  linesFromDrafts,
  removeDraft,
  sortDrafts,
} from '../lib/candidateDrafts';
import { getTheme } from '../lib/themes';
import { TranslationPath } from '../lib/i18n/translations';
import { ScheduleCandidatePicker, CandidateDraftList } from '../components/schedule/ScheduleCandidatePicker';
import { ThemeSelector } from '../components/theme/ThemeSelector';
import { Button } from '../components/common/Button';
import {
  Calendar,
  LogIn,
  AlertCircle,
  Lock,
  Globe,
  Vote as VoteIcon,
  Palette,
  MapPin,
  ChevronDown,
  Settings2,
  CheckCircle2,
  Circle,
  FileText,
  Users,
  Clock,
} from 'lucide-react';

const pad = (n: number) => String(n).padStart(2, '0');
const formatForInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const CreateSchedulePage: React.FC = () => {
  const { currentUser, signInWithGoogle } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Required
  const [title, setTitle] = useState('');
  const [drafts, setDrafts] = useState<CandidateDraft[]>([]);

  // Optional (advanced)
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [fee, setFee] = useState('');
  const [notes, setNotes] = useState('');
  const [capacityText, setCapacityText] = useState('');
  const [startDate, setStartDate] = useState(() => formatForInput(new Date()));
  const [endDate, setEndDate] = useState(() => formatForInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
  const [isPublicResult, setIsPublicResult] = useState<boolean>(true);
  const [requireAuth, setRequireAuth] = useState<boolean>(false);
  const [showVoterNames, setShowVoterNames] = useState<boolean>(true);
  const [theme, setTheme] = useState<string>('default');

  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCapacityInvalid = capacityText.trim() !== '' && normalizeCapacity(capacityText) === null;
  const isLocationUrlInvalid = locationUrl.trim() !== '' && !sanitizeHttpUrl(locationUrl);
  const sortedDrafts = sortDrafts(drafts);
  const hasTitle = title.trim().length > 0;
  const hasDates = drafts.length > 0;

  const deadlineLabel = (() => {
    const d = new Date(endDate);
    if (isNaN(d.getTime())) return endDate;
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();
  const capacityValue = normalizeCapacity(capacityText);
  const advancedSummary = [
    t('scheduleEx.advancedSummaryDeadline', { date: deadlineLabel }),
    requireAuth ? t('scheduleEx.advancedSummaryLogin') : t('scheduleEx.advancedSummaryNoLogin'),
    isPublicResult ? t('scheduleEx.advancedSummaryPublic') : t('scheduleEx.advancedSummaryPrivate'),
    capacityValue ? t('scheduleEx.advancedSummaryCapacity', { count: capacityValue }) : null,
    t('scheduleEx.advancedSummaryTheme', { name: t(getTheme(theme).nameKey as TranslationPath) }),
  ]
    .filter(Boolean)
    .join(' ・ ');

  const failAdvanced = (message: string) => {
    setShowAdvanced(true);
    showToast('error', message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      showToast('error', t('create.toastLoginReq'));
      return;
    }
    if (!hasTitle) {
      showToast('error', t('schedule.toastTitleReq'));
      return;
    }
    const lines = linesFromDrafts(sortedDrafts);
    if (lines.length < 1) {
      showToast('error', t('schedule.toastMinCandidates'));
      return;
    }
    if (lines.length > MAX_SCHEDULE_CANDIDATES) {
      showToast('error', t('schedule.toastMaxCandidates'));
      return;
    }
    if (isCapacityInvalid) return failAdvanced(t('scheduleEx.capacityInvalid'));
    if (isLocationUrlInvalid) return failAdvanced(t('scheduleEx.invalidUrl'));

    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = new Date(endDate).getTime();
    if (isNaN(startTimestamp) || isNaN(endTimestamp)) return failAdvanced(t('create.toastInvalidDates'));
    if (endTimestamp <= startTimestamp) return failAdvanced(t('create.toastEndDateFuture'));

    try {
      setIsSubmitting(true);

      const refDate = new Date(startDate);
      const options = sortScheduleOptions(candidateLinesToOptions(lines, refDate), refDate);
      const eventInfo = normalizeEventInfo({ location, locationUrl, fee, notes, capacity: capacityValue });

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
        theme,
        location: eventInfo.location || undefined,
        locationUrl: eventInfo.locationUrl || undefined,
        fee: eventInfo.fee || undefined,
        notes: eventInfo.notes || undefined,
        capacity: eventInfo.capacity ?? undefined,
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

  const inputCls =
    'w-full text-sm px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-xs';
  const subHeading = (icon: React.ReactNode, label: string) => (
    <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
      {icon}
      <span>{label}</span>
    </h4>
  );

  const ChecklistItem: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
    <li className={`flex items-center gap-2 text-sm ${ok ? 'text-emerald-700' : 'text-slate-600'}`}>
      {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4 text-slate-300" />}
      <span className={ok ? 'line-through decoration-emerald-300' : 'font-semibold'}>{label}</span>
    </li>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Mode Switch Tabs */}
      <div className="flex items-center gap-2 mb-5 p-1 rounded-2xl bg-slate-100 border border-slate-200 w-full sm:w-fit">
        <Link
          to="/create"
          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <VoteIcon className="w-4 h-4" />
          <span>{t('schedule.tabStandardPoll')}</span>
        </Link>
        <span className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-white text-indigo-600 shadow-xs">
          <Calendar className="w-4 h-4" />
          <span>{t('schedule.tabScheduleAdjust')}</span>
        </span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{t('schedule.createTitle')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('schedule.createSubtitle')}</p>
      </div>

      {!currentUser && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-sm text-amber-900">
              <span className="font-bold">{t('create.loginRequiredTitle')}</span>
              <p className="text-amber-700 mt-0.5">{t('create.loginRequiredDesc')}</p>
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

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        {/* ===== Main column ===== */}
        <div className="space-y-6 min-w-0">
          {/* Step 1: Event name (required) */}
          <section className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
            <label htmlFor="schedTitle" className="flex items-center gap-2 text-base font-black text-slate-900 mb-3">
              <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-sm flex items-center justify-center">1</span>
              <span>{t('scheduleEx.createStepTitle')}</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              id="schedTitle"
              type="text"
              required
              autoFocus
              maxLength={100}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('schedule.eventTitlePlaceholder')}
              className="w-full text-base sm:text-lg px-4 py-3 rounded-2xl border-2 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-all"
            />
          </section>

          {/* Step 2: Candidate dates (required) */}
          <section className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
                <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-sm flex items-center justify-center">2</span>
                <span>{t('scheduleEx.createStepDates')}</span>
                <span className="text-rose-500">*</span>
              </h2>
              <span className="text-sm font-bold text-indigo-600">
                {t('schedule.candidateCount', { count: drafts.length })}
              </span>
            </div>
            <ScheduleCandidatePicker value={drafts} onChange={setDrafts} listClassName="lg:hidden" />
          </section>

          {/* Advanced settings (optional, collapsed) */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              aria-expanded={showAdvanced}
              className="w-full flex items-start justify-between gap-3 p-5 sm:p-6 text-left hover:bg-slate-50/70 cursor-pointer"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-base font-black text-slate-900">
                  <Settings2 className="w-5 h-5 text-indigo-600" />
                  {t('scheduleEx.advancedTitle')}
                </span>
                <span className="block text-sm text-slate-500 mt-1">
                  {showAdvanced ? t('scheduleEx.advancedDesc') : advancedSummary}
                </span>
              </span>
              <ChevronDown
                className={`w-5 h-5 text-slate-500 shrink-0 mt-0.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              />
            </button>

            {showAdvanced && (
              <div className="px-5 sm:px-6 pb-6 space-y-7 border-t border-slate-100 pt-5">
                {/* Description */}
                <div className="space-y-2">
                  {subHeading(<FileText className="w-4 h-4 text-indigo-600" />, t('scheduleEx.sectionDescription'))}
                  <textarea
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={t('schedule.eventDescPlaceholder')}
                    className={inputCls}
                  />
                </div>

                {/* Event meta */}
                <div className="space-y-3">
                  {subHeading(<MapPin className="w-4 h-4 text-indigo-600" />, t('scheduleEx.sectionEventMeta'))}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">{t('scheduleEx.locationLabel')}</label>
                      <input type="text" maxLength={200} value={location} onChange={e => setLocation(e.target.value)} placeholder={t('scheduleEx.locationPlaceholder')} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">{t('scheduleEx.feeLabel')}</label>
                      <input type="text" maxLength={100} value={fee} onChange={e => setFee(e.target.value)} placeholder={t('scheduleEx.feePlaceholder')} className={inputCls} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">{t('scheduleEx.locationUrlLabel')}</label>
                      <input
                        type="url"
                        inputMode="url"
                        maxLength={1000}
                        value={locationUrl}
                        onChange={e => setLocationUrl(e.target.value)}
                        placeholder={t('scheduleEx.locationUrlPlaceholder')}
                        aria-invalid={isLocationUrlInvalid}
                        className={`${inputCls} ${isLocationUrlInvalid ? 'border-rose-400 focus:ring-rose-400' : ''}`}
                      />
                      {isLocationUrlInvalid && <p className="text-xs text-rose-600 mt-1">{t('scheduleEx.invalidUrl')}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">{t('scheduleEx.notesLabel')}</label>
                      <textarea rows={2} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('scheduleEx.notesPlaceholder')} className={inputCls} />
                    </div>
                  </div>
                </div>

                {/* Capacity */}
                <div className="space-y-2">
                  {subHeading(<Users className="w-4 h-4 text-indigo-600" />, t('scheduleEx.capacityLabel'))}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={1000}
                      step={1}
                      value={capacityText}
                      onChange={e => setCapacityText(e.target.value)}
                      placeholder={t('scheduleEx.capacityPlaceholder')}
                      aria-invalid={isCapacityInvalid}
                      aria-label={t('scheduleEx.capacityLabel')}
                      className={`w-32 text-sm px-3.5 py-2.5 rounded-xl border bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                        isCapacityInvalid ? 'border-rose-400' : 'border-slate-300'
                      }`}
                    />
                    <span className="text-sm text-slate-600">{t('scheduleEx.capacityUnit')}</span>
                  </div>
                  <p className={`text-xs ${isCapacityInvalid ? 'text-rose-600' : 'text-slate-500'}`}>
                    {isCapacityInvalid ? t('scheduleEx.capacityInvalid') : t('scheduleEx.capacityHint')}
                  </p>
                </div>

                {/* Response period */}
                <div className="space-y-2">
                  {subHeading(<Clock className="w-4 h-4 text-indigo-600" />, t('scheduleEx.sectionPeriod'))}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        {t('create.endDate')} <span className="text-rose-500">*</span>
                      </label>
                      <input type="datetime-local" required value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">{t('create.startDate')}</label>
                      <input type="datetime-local" required value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </div>

                {/* Respondents & visibility */}
                <div className="space-y-3">
                  {subHeading(<Lock className="w-4 h-4 text-indigo-600" />, t('scheduleEx.sectionRespondents'))}
                  <label className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition-all cursor-pointer flex items-start gap-3 select-none">
                    <input
                      type="checkbox"
                      checked={!requireAuth}
                      onChange={e => setRequireAuth(!e.target.checked)}
                      className="mt-0.5 w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="flex-1 text-sm">
                      <span className="font-bold text-slate-900 block">{t('create.noLoginCheckbox')}</span>
                      <span className="text-slate-500 mt-1 block leading-relaxed">{t('schedule.noLoginDesc')}</span>
                    </span>
                  </label>
                  <label className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition-all cursor-pointer flex items-start gap-3 select-none">
                    <input
                      type="checkbox"
                      checked={showVoterNames}
                      onChange={e => setShowVoterNames(e.target.checked)}
                      className="mt-0.5 w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="flex-1 text-sm">
                      <span className="font-bold text-slate-900 block">{t('schedule.showAttendanceNamesCheckbox')}</span>
                      <span className="text-slate-500 mt-1 block leading-relaxed">{t('schedule.showAttendanceNamesDesc')}</span>
                    </span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { value: true, icon: <Globe className="w-4 h-4 text-emerald-600" />, title: t('schedule.publicAttendanceTitle'), desc: t('schedule.publicAttendanceDesc') },
                      { value: false, icon: <Lock className="w-4 h-4 text-indigo-600" />, title: t('create.adminOnlyTitle'), desc: t('create.adminOnlyDesc') },
                    ].map(opt => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        aria-pressed={isPublicResult === opt.value}
                        onClick={() => setIsPublicResult(opt.value)}
                        className={`text-left p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                          isPublicResult === opt.value ? 'border-indigo-600 bg-indigo-50/60 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                          {opt.icon}
                          {opt.title}
                        </span>
                        <span className="block text-xs text-slate-500 mt-1">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Theme */}
                <div className="space-y-2">
                  {subHeading(<Palette className="w-4 h-4 text-indigo-600" />, t('scheduleEx.sectionTheme'))}
                  <p className="text-xs text-slate-500">{t('theme.sectionDesc')}</p>
                  <ThemeSelector selectedThemeId={theme} onSelectTheme={setTheme} />
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ===== Sidebar (sticky on desktop) ===== */}
        <aside className="lg:sticky lg:top-20 space-y-4 min-w-0">
          <div className="hidden lg:block">
            <CandidateDraftList
              drafts={sortedDrafts}
              onRemove={id => setDrafts(prev => removeDraft(prev, id))}
              onChangeTime={(id, time) => setDrafts(prev => changeDraftTime(prev, id, time))}
              onDuplicate={id => setDrafts(prev => duplicateDraftWithNewTime(prev, id, MAX_SCHEDULE_CANDIDATES).drafts)}
              onClear={() => setDrafts([])}
              scrollable
            />
          </div>

          <div className="sticky bottom-3 lg:static z-20 bg-white/95 backdrop-blur p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-lg lg:shadow-sm space-y-3">
            <p className="text-sm font-black text-slate-800">{t('scheduleEx.checklistTitle')}</p>
            <ul className="space-y-1.5">
              <ChecklistItem ok={hasTitle} label={t('scheduleEx.checklistTitleMissing')} />
              <ChecklistItem ok={hasDates} label={t('scheduleEx.checklistDatesMissing')} />
            </ul>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              disabled={!currentUser || !hasTitle || !hasDates}
              className="w-full shadow-md"
            >
              {t('schedule.submitBtn')}
            </Button>
            <p className="text-xs text-slate-500">{t('schedule.footerNote')}</p>
          </div>
        </aside>
      </form>
    </div>
  );
};
