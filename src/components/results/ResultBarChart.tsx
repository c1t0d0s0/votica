import React from 'react';
import { RoundResultSummary } from '../../lib/types';

interface ResultBarChartProps {
  summary: RoundResultSummary;
}

export const ResultBarChart: React.FC<ResultBarChartProps> = ({ summary }) => {
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
          <span className="text-[11px] font-semibold text-slate-500 block">総投票者数</span>
          <span className="text-xl font-black text-indigo-900">{summary.totalVoters} 人</span>
        </div>
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-center">
          <span className="text-[11px] font-semibold text-slate-500 block">総票数</span>
          <span className="text-xl font-black text-indigo-900">{summary.totalVotes} 票</span>
        </div>
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-center col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-slate-500 block">最多得票数</span>
          <span className="text-xl font-black text-indigo-900">{maxVotes} 票</span>
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
                  ? 'bg-white border-amber-300 shadow-md shadow-amber-50 dark:border-amber-700'
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
                  <span className="text-sm font-black text-slate-900">{r.votesCount} 票</span>
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
            </div>
          );
        })}
      </div>
    </div>
  );
};
