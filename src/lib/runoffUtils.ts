import { PollOption, PollRound, Vote, OptionResult, RoundResultSummary } from './types';

export const OPTION_COLORS = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#0ea5e9', // Sky
  '#8b5cf6', // Violet
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#d946ef', // Fuchsia
  '#84cc16', // Lime
  '#e11d48', // Rose
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#10b981', // Emerald-dark
  '#f43f5e', // Rose-dark
  '#64748b', // Slate
  '#ca8a04', // Yellow
  '#0284c7', // Sky-dark
  '#7c3aed', // Violet-dark
];

export function getOptionColor(index: number): string {
  return OPTION_COLORS[index % OPTION_COLORS.length];
}

/**
 * Calculates results, ranks, percentages, and tie status for a specific round.
 */
export function calculateRoundResults(round: PollRound, votes: Vote[]): RoundResultSummary {
  const totalVoters = votes.length;
  let totalVotes = 0;

  // Initialize count map
  const countMap = new Map<string, number>();
  round.options.forEach(opt => countMap.set(opt.id, 0));

  votes.forEach(v => {
    v.selectedOptionIds.forEach(optId => {
      if (countMap.has(optId)) {
        countMap.set(optId, (countMap.get(optId) || 0) + 1);
        totalVotes++;
      }
    });
  });

  // Build raw list with voter breakdown
  const unrankedList: Array<{
    option: PollOption;
    votesCount: number;
    voters: { userId: string; userDisplayName: string; userPhotoURL?: string }[];
  }> = round.options.map((opt, idx) => {
    const optionVoters: { userId: string; userDisplayName: string; userPhotoURL?: string }[] = [];
    votes.forEach(v => {
      if (v.selectedOptionIds.includes(opt.id)) {
        optionVoters.push({
          userId: v.userId,
          userDisplayName: v.userDisplayName || '参加者',
          userPhotoURL: v.userPhotoURL,
        });
      }
    });

    return {
      option: {
        ...opt,
        color: opt.color || getOptionColor(idx),
      },
      votesCount: countMap.get(opt.id) || 0,
      voters: optionVoters,
    };
  });

  // Sort by votesCount descending, then alphabetically/by original index for stable sort
  unrankedList.sort((a, b) => b.votesCount - a.votesCount);

  // Assign ranks (with standard competition ranking: 1, 1, 3...)
  let currentRank = 1;
  const results: OptionResult[] = [];

  for (let i = 0; i < unrankedList.length; i++) {
    if (i > 0 && unrankedList[i].votesCount < unrankedList[i - 1].votesCount) {
      currentRank = i + 1;
    }
    const item = unrankedList[i];
    const percentage = totalVoters > 0 ? Math.round((item.votesCount / totalVoters) * 1000) / 10 : 0;

    results.push({
      option: item.option,
      votesCount: item.votesCount,
      percentage,
      rank: currentRank,
      voters: item.voters,
    });
  }

  // Find 1st place options
  const firstRankOptions = results.filter(r => r.rank === 1);
  const maxVotes = results.length > 0 ? results[0].votesCount : 0;
  
  // Tie exists for 1st place if more than 1 option is rank 1 and at least 1 vote was cast
  const hasTieForFirst = firstRankOptions.length > 1 && maxVotes > 0;
  const tiedFirstOptions = hasTieForFirst ? firstRankOptions : [];

  // Single winner exists if exactly 1 option has rank 1 and maxVotes > 0
  const winner = !hasTieForFirst && maxVotes > 0 && firstRankOptions.length === 1 ? firstRankOptions[0] : null;

  // Mark flags on individual items
  results.forEach(r => {
    r.isWinner = winner?.option.id === r.option.id;
    r.isTied = r.rank === 1 && hasTieForFirst;
  });

  const topOptions = results.slice(0, Math.min(3, results.length));

  return {
    roundNumber: round.roundNumber,
    totalVotes,
    totalVoters,
    results,
    topOptions,
    hasTieForFirst,
    tiedFirstOptions,
    winner,
  };
}

/**
 * Filter candidate options for runoff based on tie detection, top K, or custom selection.
 */
export function filterCandidatesForRunoff(
  summary: RoundResultSummary,
  mode: 'tie_breaker' | 'top_k' | 'manual',
  topK = 2,
  customOptionIds?: string[]
): PollOption[] {
  if (mode === 'tie_breaker') {
    if (summary.tiedFirstOptions.length > 0) {
      return summary.tiedFirstOptions.map(r => r.option);
    }
    // If no tie, fallback to top 2
    return summary.results.slice(0, 2).map(r => r.option);
  }

  if (mode === 'top_k') {
    const k = Math.max(2, Math.min(topK, summary.results.length));
    return summary.results.slice(0, k).map(r => r.option);
  }

  if (mode === 'manual' && customOptionIds && customOptionIds.length >= 2) {
    return summary.results
      .filter(r => customOptionIds.includes(r.option.id))
      .map(r => r.option);
  }

  // Default fallback
  return summary.results.slice(0, 2).map(r => r.option);
}

/**
 * Format date string to Japanese readable format (e.g. 2026/08/20 18:00)
 */
export function formatDateTime(isoString: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${h}:${min}`;
}
