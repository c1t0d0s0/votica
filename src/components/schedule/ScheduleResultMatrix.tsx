import React, { useState } from 'react';
import { Poll, PollRound, ScheduleChoice, ScheduleResultSummary } from '../../lib/types';
import { SCHEDULE_SYMBOLS, formatScheduleExportText, formatScheduleCsv } from '../../lib/scheduleUtils';
import { useTranslation } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../common/Button';
import {
  Users,
  Copy,
  Download,
  Crown,
  MessageSquare,
  Calendar,
} from 'lucide-react';

interface ScheduleResultMatrixProps {
  poll: Poll;
  round: PollRound;
  summary: ScheduleResultSummary;
}

export const ScheduleResultMatrix: React.FC<ScheduleResultMatrixProps> = ({
  poll,
  round,
  summary,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyText = async () => {
    try {
      const text = formatScheduleExportText(poll, round, summary);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast('success', t('schedule.toastTextCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('error', 'クリップボードへのコピーに失敗しました');
    }
  };

  const handleDownloadCsv = () => {
    try {
      const csv = formatScheduleCsv(round, summary);
      // UTF-8 BOM for Excel compatibility with Japanese
      const bom = '\uFEFF';
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `schedule_${poll.title.replace(/[\s/\\:*?"<>|]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('success', t('schedule.toastCsvDownloaded'));
    } catch (e) {
      console.error('CSV export failed:', e);
      showToast('error', 'CSVのダウンロードに失敗しました');
    }
  };

  const renderSymbolBadge = (choice: ScheduleChoice | undefined) => {
    if (!choice) {
      return <span className="text-slate-300 font-bold">-</span>;
    }
    const meta = SCHEDULE_SYMBOLS[choice];
    return (
      <span
        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-bold text-sm ${meta.bgClass} ${meta.borderClass} ${meta.textClass} border`}
      >
        {meta.symbol}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Best Date Banner */}
      {summary.bestOptions.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-400/10 to-orange-500/10 border-2 border-amber-300 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-white flex items-center justify-center shadow-md shadow-amber-200 shrink-0 mt-0.5 sm:mt-0">
              <Crown className="w-6 h-6 fill-white text-white" />
            </div>
            <div>
              <span className="text-[11px] font-black tracking-wider uppercase text-amber-800 block">
                {t('schedule.bestCandidateLabel')}
              </span>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                {summary.bestOptions.map(best => (
                  <span
                    key={best.option.id}
                    className="text-base sm:text-lg font-black text-slate-900"
                  >
                    {best.option.text}
                  </span>
                ))}
              </div>
              <p className="text-xs text-amber-900 mt-1">
                {t('schedule.bestCandidateDesc', {
                  circles: summary.bestOptions[0].circleCount,
                  total: summary.totalVoters,
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Controls & Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>{t('schedule.attendanceTableTitle')}</span>
          </span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            {t('schedule.votersCount', { count: summary.totalVoters })}
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyText}
            leftIcon={<Copy className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            {copied ? t('common.copied') : t('schedule.copyTextBtn')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCsv}
            leftIcon={<Download className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            {t('schedule.downloadCsvBtn')}
          </Button>
        </div>
      </div>

      {/* Main Attendance Matrix Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="py-3 px-4 font-bold text-slate-700 w-44 sticky left-0 bg-slate-50/95 backdrop-blur-xs z-10">
                  {t('schedule.candidateDateCol')}
                </th>
                <th className="py-3 px-3 font-bold text-slate-600 text-center w-24">
                  {t('schedule.scoreCol')}
                </th>
                <th className="py-3 px-3 font-bold text-slate-600 text-center w-28">
                  {t('schedule.tallyCol')}
                </th>
                {summary.voters.map(voter => (
                  <th
                    key={voter.userId}
                    className="py-3 px-3 font-bold text-slate-800 text-center min-w-[90px] max-w-[120px]"
                  >
                    <div className="flex flex-col items-center gap-1">
                      {voter.userPhotoURL ? (
                        <img
                          src={voter.userPhotoURL}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                          {voter.userDisplayName[0] || 'U'}
                        </div>
                      )}
                      <span className="truncate max-w-[90px] block" title={voter.userDisplayName}>
                        {voter.userDisplayName}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.options.map(optSummary => {
                return (
                  <tr
                    key={optSummary.option.id}
                    className={`hover:bg-slate-50/60 transition-colors ${
                      optSummary.isBest ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    {/* Date label */}
                    <td
                      className={`py-3.5 px-4 font-bold text-slate-900 sticky left-0 z-10 ${
                        optSummary.isBest ? 'bg-amber-50/90 backdrop-blur-xs' : 'bg-white/95 backdrop-blur-xs'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {optSummary.isBest && (
                          <Crown className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
                        )}
                        <span className="leading-snug">{optSummary.option.text}</span>
                      </div>
                      {optSummary.option.description && (
                        <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                          {optSummary.option.description}
                        </p>
                      )}
                    </td>

                    {/* Score / Rank */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-block font-black text-sm text-indigo-900">
                        {optSummary.score}
                        <span className="text-[10px] font-normal text-slate-400 ml-0.5">pt</span>
                      </span>
                    </td>

                    {/* Breakdown Counts */}
                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-bold">
                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          ◯ {optSummary.circleCount}
                        </span>
                        <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          △ {optSummary.triangleCount}
                        </span>
                        <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                          ✗ {optSummary.crossCount}
                        </span>
                      </div>
                    </td>

                    {/* Voter responses */}
                    {summary.voters.map(voter => {
                      const choice = voter.responses[optSummary.option.id];
                      return (
                        <td key={voter.userId} className="py-3.5 px-3 text-center">
                          {renderSymbolBadge(choice)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Comments row if any */}
              {summary.voters.some(v => Boolean(v.comment)) && (
                <tr className="bg-slate-50/70 border-t-2 border-slate-200 font-medium">
                  <td className="py-3 px-4 text-xs font-bold text-slate-600 sticky left-0 bg-slate-50/95 z-10 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{t('schedule.commentsRow')}</span>
                  </td>
                  <td className="py-3 px-3 text-center text-slate-400">-</td>
                  <td className="py-3 px-3 text-center text-slate-400">-</td>
                  {summary.voters.map(voter => (
                    <td
                      key={voter.userId}
                      className="py-3 px-3 text-center text-[11px] text-slate-600 leading-relaxed max-w-[140px]"
                    >
                      {voter.comment ? (
                        <div
                          className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs text-left"
                          title={voter.comment}
                        >
                          {voter.comment}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {summary.totalVoters === 0 && (
        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700">{t('schedule.noVotesYetTitle')}</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {t('schedule.noVotesYetDesc')}
          </p>
        </div>
      )}
    </div>
  );
};
