import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { PollOption, PollRound, RoundResultSummary } from '../../lib/types';
import { createRunoffRound } from '../../lib/firestoreService';
import { filterCandidatesForRunoff, getOptionColor } from '../../lib/runoffUtils';
import { Swords, Check, Users, Sparkles, Layers } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../contexts/LanguageContext';

interface RunoffWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  pollId: string;
  previousRound: PollRound;
  summary: RoundResultSummary;
  nextRoundNumber: number;
  onSuccess: (roundNumber: number) => void;
}

export const RunoffWizardModal: React.FC<RunoffWizardModalProps> = ({
  isOpen,
  onClose,
  pollId,
  previousRound,
  summary,
  nextRoundNumber,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initial candidate selection mode
  const initialMode = summary.hasTieForFirst ? 'tie_breaker' : 'top_k';
  const [runoffMode, setRunoffMode] = useState<'tie_breaker' | 'top_k' | 'manual'>(initialMode);
  const [topKCount] = useState<number>(2);

  // Candidates
  const initialCandidates = filterCandidatesForRunoff(summary, initialMode, 2);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>(
    initialCandidates.map(c => c.id)
  );

  // Round settings
  const defaultTitle = summary.hasTieForFirst
    ? t('runoffModal.defaultTitleTie', { round: nextRoundNumber })
    : t('runoffModal.defaultTitleGeneral', { round: nextRoundNumber });
  const [title, setTitle] = useState(defaultTitle);
  const [description] = useState(
    summary.hasTieForFirst
      ? t('runoffModal.defaultDescTie')
      : t('runoffModal.defaultDescTopK')
  );

  // Dates
  const now = new Date();
  const defaultEnd = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours later
  const formatInputDate = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  };

  const [startDate, setStartDate] = useState(formatInputDate(now));
  const [endDate, setEndDate] = useState(formatInputDate(defaultEnd));
  const [maxChoices, setMaxChoices] = useState(1);

  // Handle Mode Change
  const handleModeChange = (mode: 'tie_breaker' | 'top_k' | 'manual', k = topKCount) => {
    setRunoffMode(mode);
    const candidates = filterCandidatesForRunoff(summary, mode, k);
    setSelectedCandidateIds(candidates.map(c => c.id));
    if (mode === 'tie_breaker') {
      setTitle(t('runoffModal.defaultTitleTie', { round: nextRoundNumber }));
    } else if (mode === 'top_k') {
      setTitle(t('runoffModal.defaultTitleTopK', { round: nextRoundNumber, k }));
    }
  };

  const toggleCandidate = (optId: string) => {
    setRunoffMode('manual');
    if (selectedCandidateIds.includes(optId)) {
      if (selectedCandidateIds.length <= 2) {
        showToast('warning', t('runoffModal.toastMinCandidatesWarning'));
        return;
      }
      setSelectedCandidateIds(prev => prev.filter(id => id !== optId));
    } else {
      setSelectedCandidateIds(prev => [...prev, optId]);
    }
  };

  const handleCreateRunoff = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedCandidateIds.length < 2) {
      showToast('error', t('runoffModal.toastMinCandidatesWarning'));
      return;
    }

    if (new Date(endDate).getTime() <= new Date(startDate).getTime()) {
      showToast('error', t('create.dateOrderError'));
      return;
    }

    // Get the option objects matching selected IDs
    const runoffOptions: PollOption[] = summary.results
      .filter(r => selectedCandidateIds.includes(r.option.id))
      .map((r, idx) => ({
        ...r.option,
        color: r.option.color || getOptionColor(idx),
      }));

    const newRound: Omit<PollRound, 'roundNumber'> = {
      title: title.trim() || t('runoffModal.defaultTitleGeneral', { round: nextRoundNumber }),
      description: description.trim(),
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      maxChoices: Math.min(maxChoices, runoffOptions.length),
      options: runoffOptions,
      status: 'open',
      runoffSourceRound: previousRound.roundNumber,
      candidateSource: runoffMode,
    };

    try {
      setIsSubmitting(true);
      await createRunoffRound(pollId, newRound, nextRoundNumber);
      showToast('success', t('runoffModal.toastSuccess', { round: nextRoundNumber }));
      onSuccess(nextRoundNumber);
      onClose();
    } catch (err: any) {
      console.error('Failed to create runoff:', err);
      showToast('error', t('runoffModal.toastError') + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('runoffModal.title', { round: nextRoundNumber })}
      description={t('runoffModal.desc')}
      maxWidth="xl"
    >
      <form onSubmit={handleCreateRunoff} className="space-y-5">
        {/* Mode Selector Tabs */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            {t('runoffModal.candidateMethodLabel')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {summary.hasTieForFirst && (
              <button
                type="button"
                onClick={() => handleModeChange('tie_breaker')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  runoffMode === 'tie_breaker'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold shadow-sm'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('runoffModal.recommendedBadge')}</span>
                </div>
                <div className="text-xs font-semibold">{t('runoffModal.tiedOnlyTitle')}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {t('runoffModal.tiedCandidatesDesc', { count: summary.tiedFirstOptions.length })}
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleModeChange('top_k', 2)}
              className={`p-3 rounded-xl border text-left transition-all ${
                runoffMode === 'top_k' && topKCount === 2
                  ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold shadow-sm'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                <Layers className="w-3.5 h-3.5" />
                <span>{t('runoffModal.topKBadge', { k: 2 })}</span>
              </div>
              <div className="text-xs font-semibold">{t('runoffModal.topKTitle', { k: 2 })}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{t('runoffModal.topKDesc', { k: 2 })}</div>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('manual')}
              className={`p-3 rounded-xl border text-left transition-all ${
                runoffMode === 'manual'
                  ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold shadow-sm'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                <Users className="w-3.5 h-3.5" />
                <span>{t('runoffModal.customBadge')}</span>
              </div>
              <div className="text-xs font-semibold">{t('runoffModal.customTitle')}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{t('runoffModal.customDesc')}</div>
            </button>
          </div>
        </div>

        {/* Selected Candidates list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-700">
              {t('runoffModal.selectedCandidatesLabel', { count: selectedCandidateIds.length })}
            </label>
            <span className="text-[11px] text-slate-500">{t('runoffModal.clickToToggle')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
            {summary.results.map(r => {
              const isSelected = selectedCandidateIds.includes(r.option.id);
              return (
                <div
                  key={r.option.id}
                  onClick={() => toggleCandidate(r.option.id)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-white shadow-sm font-semibold text-slate-900'
                      : 'border-transparent bg-slate-100/70 text-slate-400 opacity-60'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span
                    className="w-2 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: r.option.color }}
                  />
                  <span className="flex-1 truncate">{r.option.text}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {t('runoffModal.previousStats', { votes: r.votesCount, rank: r.rank })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Round Settings */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {t('runoffModal.roundTitleLabel')}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white shadow-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t('create.startDate')}</label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t('create.endDate')}</label>
              <input
                type="datetime-local"
                required
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {t('create.maxChoicesLabel')}
            </label>
            <select
              value={maxChoices}
              onChange={e => setMaxChoices(Number(e.target.value))}
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium shadow-sm"
            >
              <option value={1}>{t('runoffModal.singleChoiceOption')}</option>
              {selectedCandidateIds.length > 2 && (
                <option value={2}>{t('create.multiChoiceOption', { count: 2 })}</option>
              )}
              {selectedCandidateIds.length > 3 && (
                <option value={3}>{t('create.multiChoiceOption', { count: 3 })}</option>
              )}
            </select>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            leftIcon={<Swords className="w-4 h-4" />}
          >
            {t('runoffModal.submitRunoffBtn', { round: nextRoundNumber })}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
