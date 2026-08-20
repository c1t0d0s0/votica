import React from 'react';
import { PollRound } from '../../lib/types';
import { Layers, Swords } from 'lucide-react';

interface RoundSelectorProps {
  rounds: PollRound[];
  selectedRoundNumber: number;
  currentActiveRoundNumber: number;
  onSelectRound: (roundNumber: number) => void;
}

export const RoundSelector: React.FC<RoundSelectorProps> = ({
  rounds,
  selectedRoundNumber,
  currentActiveRoundNumber,
  onSelectRound,
}) => {
  if (rounds.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
      <span className="text-xs font-bold text-slate-500 shrink-0 flex items-center gap-1">
        <Layers className="w-3.5 h-3.5" />
        ラウンド切替:
      </span>
      <div className="flex items-center gap-1.5">
        {rounds.map(round => {
          const isSelected = round.roundNumber === selectedRoundNumber;
          const isCurrentActive = round.roundNumber === currentActiveRoundNumber;
          const isRunoff = round.roundNumber > 1;

          return (
            <button
              key={round.roundNumber}
              onClick={() => onSelectRound(round.roundNumber)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {isRunoff && <Swords className="w-3 h-3 text-current" />}
              <span>{round.title || `第${round.roundNumber}ラウンド`}</span>
              {isCurrentActive && (
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  進行中
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
