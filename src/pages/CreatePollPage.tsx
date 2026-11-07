import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../contexts/LanguageContext';
import { createPoll } from '../lib/firestoreService';
import { PollOption, PollRound, Poll } from '../lib/types';
import { OptionInputList } from '../components/poll/OptionInputList';
import { ThemeSelector } from '../components/theme/ThemeSelector';
import { Button } from '../components/common/Button';
import {
  CreateModeTabs,
  StepCard,
  TitleInput,
  AdvancedSettings,
  SubHeading,
  SubmitPanel,
} from '../components/create/CreateFormParts';
import { getOptionColor } from '../lib/runoffUtils';
import { getTheme } from '../lib/themes';
import { TranslationPath } from '../lib/i18n/translations';
import { Lock, Globe, LogIn, AlertCircle, Palette, FileText, Clock, ListChecks } from 'lucide-react';

const pad = (n: number) => String(n).padStart(2, '0');
const formatForInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const CreatePollPage: React.FC = () => {
  const { currentUser, signInWithGoogle } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Required
  const [title, setTitle] = useState('');
  // Options (starts with 3 options, up to 20)
  const [options, setOptions] = useState<PollOption[]>([
    { id: 'opt_1', text: '', color: getOptionColor(0) },
    { id: 'opt_2', text: '', color: getOptionColor(1) },
    { id: 'opt_3', text: '', color: getOptionColor(2) },
  ]);

  // Optional (advanced)
  const [description, setDescription] = useState('');
  // Default period: start now, end 24 hours later
  const [startDate, setStartDate] = useState(() => formatForInput(new Date()));
  const [endDate, setEndDate] = useState(() => formatForInput(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [maxChoices, setMaxChoices] = useState<number>(1);
  const [isPublicResult, setIsPublicResult] = useState<boolean>(false);
  const [requireAuth, setRequireAuth] = useState<boolean>(true);
  const [showVoterNames, setShowVoterNames] = useState<boolean>(false);
  const [theme, setTheme] = useState<string>('default');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Empty option rows are ignored on submit
  const filledOptions = options.filter(o => o.text.trim()).map(o => ({ ...o, text: o.text.trim() }));
  const hasTitle = title.trim().length > 0;
  const hasOptions = filledOptions.length >= 2;
  const effectiveMaxChoices = Math.max(1, Math.min(maxChoices, Math.max(filledOptions.length, 1)));

  const deadlineLabel = (() => {
    const d = new Date(endDate);
    if (isNaN(d.getTime())) return endDate;
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();
  const advancedSummary = [
    t('scheduleEx.advancedSummaryDeadline', { date: deadlineLabel }),
    maxChoices === 1 ? t('create.summarySingle') : t('create.summaryMulti', { count: maxChoices }),
    requireAuth ? t('scheduleEx.advancedSummaryLogin') : t('scheduleEx.advancedSummaryNoLogin'),
    isPublicResult ? t('create.summaryResultsPublic') : t('create.summaryResultsPrivate'),
    showVoterNames ? t('create.summaryVoterNames') : null,
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
      showToast('error', t('create.toastTitleReq'));
      return;
    }
    if (filledOptions.length < 2) {
      showToast('error', t('create.toastMinOptions'));
      return;
    }
    if (filledOptions.length > 20) {
      showToast('error', t('create.toastMaxOptions'));
      return;
    }

    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = new Date(endDate).getTime();
    if (isNaN(startTimestamp) || isNaN(endTimestamp)) return failAdvanced(t('create.toastInvalidDates'));
    if (endTimestamp <= startTimestamp) return failAdvanced(t('create.toastEndDateFuture'));

    try {
      setIsSubmitting(true);

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
        theme,
      };

      const initialRound: Omit<PollRound, 'roundNumber'> = {
        title: t('create.defaultRoundTitle'),
        description: t('create.defaultRoundDesc'),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        maxChoices: Math.min(maxChoices, filledOptions.length),
        options: filledOptions,
        status: 'open',
        candidateSource: 'manual',
      };

      const pollId = await createPoll(pollData, initialRound);
      navigate(`/poll/${pollId}?created=1`);
    } catch (err: any) {
      console.error('Failed to create poll:', err);
      showToast('error', t('create.toastFailed') + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls =
    'w-full text-sm px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-xs';

  // Choices: 1..min(10, filled options) (at least 1)
  const maxChoiceCandidates = Array.from({ length: Math.max(1, Math.min(10, filledOptions.length)) }, (_, i) => i + 1);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <CreateModeTabs active="poll" />

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{t('create.title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('create.subtitle')}</p>
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
          <StepCard step={1} title={t('create.stepTitle')} htmlFor="pollTitle">
            <TitleInput id="pollTitle" value={title} onChange={setTitle} placeholder={t('create.pollTitlePlaceholder')} />
          </StepCard>

          <StepCard
            step={2}
            title={t('create.stepOptions')}
            aside={<span className="text-sm font-bold text-indigo-600">{filledOptions.length} / 20</span>}
          >
            <OptionInputList options={options} onChange={setOptions} maxLimit={20} />
          </StepCard>

          <AdvancedSettings
            open={showAdvanced}
            onToggle={() => setShowAdvanced(v => !v)}
            summary={advancedSummary}
            description={t('create.advancedDesc')}
          >
            {/* Description */}
            <div className="space-y-2">
              <SubHeading icon={<FileText className="w-4 h-4 text-indigo-600" />} label={t('create.sectionDescription')} />
              <textarea
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('create.pollDescPlaceholder')}
                className={inputCls}
              />
            </div>

            {/* Voting period */}
            <div className="space-y-2">
              <SubHeading icon={<Clock className="w-4 h-4 text-indigo-600" />} label={t('create.sectionPeriod')} />
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

            {/* Max choices */}
            <div className="space-y-2">
              <SubHeading icon={<ListChecks className="w-4 h-4 text-indigo-600" />} label={t('create.sectionMaxChoices')} />
              <select
                value={effectiveMaxChoices}
                onChange={e => setMaxChoices(Number(e.target.value))}
                aria-label={t('create.maxChoicesLabel')}
                className={`${inputCls} md:w-80 font-medium`}
              >
                {maxChoiceCandidates.map(n => (
                  <option key={n} value={n}>
                    {n === 1 ? t('create.singleChoiceOption') : t('create.multiChoiceOption', { count: n })}
                  </option>
                ))}
              </select>
            </div>

            {/* Voters & visibility */}
            <div className="space-y-3">
              <SubHeading icon={<Lock className="w-4 h-4 text-indigo-600" />} label={t('create.sectionRespondents')} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { value: false, icon: <Lock className="w-4 h-4 text-indigo-600" />, title: t('create.adminOnlyTitle'), desc: t('create.adminOnlyDesc') },
                  { value: true, icon: <Globe className="w-4 h-4 text-emerald-600" />, title: t('create.publicResultTitle'), desc: t('create.publicResultDesc') },
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
              <label className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition-all cursor-pointer flex items-start gap-3 select-none">
                <input
                  type="checkbox"
                  checked={!requireAuth}
                  onChange={e => setRequireAuth(!e.target.checked)}
                  className="mt-0.5 w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="flex-1 text-sm">
                  <span className="font-bold text-slate-900 block">{t('create.noLoginCheckbox')}</span>
                  <span className="text-slate-500 mt-1 block leading-relaxed">{t('create.noLoginCheckboxDesc')}</span>
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
                  <span className="font-bold text-slate-900 block">{t('create.showVoterNamesCheckbox')}</span>
                  <span className="text-slate-500 mt-1 block leading-relaxed">{t('create.showVoterNamesDesc')}</span>
                </span>
              </label>
            </div>

            {/* Theme */}
            <div className="space-y-2">
              <SubHeading icon={<Palette className="w-4 h-4 text-indigo-600" />} label={t('scheduleEx.sectionTheme')} />
              <p className="text-xs text-slate-500">{t('theme.sectionDesc')}</p>
              <ThemeSelector selectedThemeId={theme} onSelectTheme={setTheme} />
            </div>
          </AdvancedSettings>
        </div>

        {/* ===== Sidebar (sticky on desktop) ===== */}
        <aside className="lg:sticky lg:top-20 space-y-4 min-w-0">
          <SubmitPanel
            checks={[
              { ok: hasTitle, label: t('create.checklistTitle') },
              { ok: hasOptions, label: t('create.checklistOptions') },
            ]}
            submitLabel={t('create.submitButton')}
            note={t('create.footerNote')}
            isLoading={isSubmitting}
            disabled={!currentUser || !hasTitle || !hasOptions}
          />
        </aside>
      </form>
    </div>
  );
};
