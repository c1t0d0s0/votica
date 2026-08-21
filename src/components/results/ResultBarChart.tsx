import React from 'react';
import { RoundResultSummary } from '../../lib/types';
import { Users } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';

interface ResultBarChartProps {
  summary: RoundResultSummary;
  showVoterNames?: boolean;
}

export const ResultBarChart: React.FC<ResultBarChartProps> = ({
  summary,
  showVoterNames = false,
}) => {
  const { t } = useTranslation();

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-400 text-white font-black text-xs shadow-md shadow-amber-200">
          🥇 1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-300 text-slate-800 font-black text-xs shadow-sm">
          🥈 2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-700/60 text-white font-black text-xs shadow-sm">
          🥉 3
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-100 text-slate-500 font-bold text-xs">
        {rank}
      </span>
    );
  };

  const maxVotes = summary.results.length > 0 ? summary.results[0].votesCount : 0;

  return (
    <div className="space-y-4">
      {/* Overview Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-center">
          <span className="text-[11px] font-semibold text-slate-500 block">{t('chart.totalVoters')}</span>
          <span className="text-xl font-black text-indigo-900">{summary.totalVoters} {t('chart.votersUnit')}</span>
        </div>
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-center">
          <span className="text-[11px] font-semibold text-slate-500 block">{t('chart.totalVotes')}</span>
          <span className="text-xl font-black text-indigo-900">{summary.totalVotes} {t('chart.votesUnit')}</span>
        </div>
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-center col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-slate-500 block">{t('chart.maxVotes')}</span>
          <span className="text-xl font-black text-indigo-900">{maxVotes} {t('chart.votesUnit')}</span>
        </div>
      </div>

      {/* Result Rows */}
      <div className="space-y-3 pt-2">
        {summary.results.map(r => {
          const isTop = r.rank === 1 && r.votesCount > 0;
          const barWidth = summary.totalVoters > 0 ? (r.votesCount / summary.totalVoters) * 100 : 0;

          return (
            <div
              key={r.option.id}
              className={`p-4 rounded-2xl border transition-all ${
                isTop
                  ? 'bg-white border-amber-300 shadow-md shadow-amber-50'
                  : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  {getRankBadge(r.rank)}
                  <div className="min-w-0">
                    <h5 className="text-sm font-bold text-slate-900 truncate">
                      {r.option.text}
                    </h5>
                    {r.option.description && (
                      <p className="text-[11px] text-slate-400 truncate">{r.option.description}</p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-black text-slate-900">{r.votesCount} {t('chart.votesUnit')}</span>
                  <span className="text-xs font-semibold text-slate-400 ml-1.5">
                    ({r.percentage}%)
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.max(barWidth, r.votesCount > 0 ? 3 : 0)}%`,
                    backgroundColor: r.option.color || '#6366f1',
                  }}
                />
              </div>

              {/* Voter Breakdown (when enabled by creator) */}
              {showVoterNames && r.voters && r.voters.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 shrink-0 mr-1">
                    <Users className="w-3 h-3 text-indigo-500" />
                    {t('chart.votersBreakdown', { count: r.voters.length })}
                  </span>
                  {r.voters.map((v, vIdx) => (
                    <span
                      key={v.userId + '_' + vIdx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-medium"
                    >
                      {v.userPhotoURL && (
                        <img
                          src={v.userPhotoURL}
                          alt=""
                          className="w-3 h-3 rounded-full object-cover"
                        />
                      )}
                      <span>{v.userDisplayName}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
