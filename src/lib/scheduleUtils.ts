import { Poll, PollRound, PollOption, Vote, ScheduleChoice, ScheduleOptionSummary, ScheduleVoterRow, ScheduleResultSummary } from './types';
import { getOptionColor } from './runoffUtils';

export const SCHEDULE_SYMBOLS: Record<ScheduleChoice, { symbolJa: string; symbolEn: string; labelJa: string; labelEn: string; colorClass: string; bgClass: string; borderClass: string; textClass: string }> = {
  circle: {
    symbolJa: '◯',
    symbolEn: '✓',
    labelJa: '参加',
    labelEn: 'Available',
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-50 hover:bg-emerald-100',
    borderClass: 'border-emerald-300',
    textClass: 'text-emerald-700',
  },
  triangle: {
    symbolJa: '△',
    symbolEn: '?',
    labelJa: '未定 / 条件付き',
    labelEn: 'Maybe',
    colorClass: 'text-amber-500',
    bgClass: 'bg-amber-50 hover:bg-amber-100',
    borderClass: 'border-amber-300',
    textClass: 'text-amber-700',
  },
  cross: {
    symbolJa: '✗',
    symbolEn: '✕',
    labelJa: '不参加',
    labelEn: 'Unavailable',
    colorClass: 'text-rose-500',
    bgClass: 'bg-rose-50 hover:bg-rose-100',
    borderClass: 'border-rose-300',
    textClass: 'text-rose-700',
  },
};

/**
 * Returns the localized symbol for a choice (ja: ◯/△/✗, en: ✓/?/✕).
 */
export function getScheduleSymbol(choice: ScheduleChoice, language: string = 'ja'): string {
  const meta = SCHEDULE_SYMBOLS[choice];
  if (!meta) return '';
  return language === 'en' ? meta.symbolEn : meta.symbolJa;
}

/**
 * Converts a raw multiline string of candidate dates into an array of trimmed date strings.
 */
export function parseScheduleCandidateLines(rawText: string): string[] {
  if (!rawText) return [];
  return rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/**
 * Converts parsed date strings into PollOption array.
 */
export function candidateLinesToOptions(lines: string[]): PollOption[] {
  return lines.map((line, idx) => ({
    id: `opt_sched_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`,
    text: line,
    color: getOptionColor(idx),
  }));
}

/**
 * Formats a Date object into Japanese date format, e.g. "8/25(月) 19:00〜"
 */
export function formatQuickDate(d: Date, timeStr = '19:00〜'): string {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const dayOfWeek = dayNames[d.getDay()];
  return `${month}/${date}(${dayOfWeek}) ${timeStr}`;
}

/**
 * Calculates schedule adjustment results, voter matrix, option scores, and best dates.
 */
export function calculateScheduleResults(round: PollRound, votes: Vote[]): ScheduleResultSummary {
  const totalVoters = votes.length;

  // Build voter rows
  const voterRows: ScheduleVoterRow[] = votes.map(v => {
    const responses: Record<string, ScheduleChoice> = {};
    if (v.scheduleResponses) {
      Object.assign(responses, v.scheduleResponses);
    } else if (v.selectedOptionIds && v.selectedOptionIds.length > 0) {
      // Compatibility if answered as standard poll
      round.options.forEach(opt => {
        if (v.selectedOptionIds.includes(opt.id)) {
          responses[opt.id] = 'circle';
        } else {
          responses[opt.id] = 'cross';
        }
      });
    }

    return {
      userId: v.userId,
      userDisplayName: v.userDisplayName || '参加者',
      userPhotoURL: v.userPhotoURL,
      responses,
      comment: v.comment,
      votedAt: v.votedAt,
    };
  });

  // Calculate summary per option
  const optionSummariesUnranked: Array<{
    option: PollOption;
    circleCount: number;
    triangleCount: number;
    crossCount: number;
    score: number;
  }> = round.options.map((opt, idx) => {
    let circleCount = 0;
    let triangleCount = 0;
    let crossCount = 0;

    voterRows.forEach(voter => {
      const choice = voter.responses[opt.id];
      if (choice === 'circle') {
        circleCount++;
      } else if (choice === 'triangle') {
        triangleCount++;
      } else if (choice === 'cross') {
        crossCount++;
      }
    });

    // Score weight: circle = 2 points, triangle = 1 point
    const score = circleCount * 2 + triangleCount * 1;

    return {
      option: {
        ...opt,
        color: opt.color || getOptionColor(idx),
      },
      circleCount,
      triangleCount,
      crossCount,
      score,
    };
  });

  // Sort by score desc, then circleCount desc, then crossCount asc
  const sorted = [...optionSummariesUnranked].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.circleCount !== a.circleCount) return b.circleCount - a.circleCount;
    return a.crossCount - b.crossCount;
  });

  // Assign ranks
  let currentRank = 1;
  const rankedMap = new Map<string, number>();

  for (let i = 0; i < sorted.length; i++) {
    if (
      i > 0 &&
      (sorted[i].score < sorted[i - 1].score ||
        (sorted[i].score === sorted[i - 1].score && sorted[i].circleCount < sorted[i - 1].circleCount))
    ) {
      currentRank = i + 1;
    }
    rankedMap.set(sorted[i].option.id, currentRank);
  }

  const maxScore = sorted.length > 0 ? sorted[0].score : 0;
  const maxCircles = sorted.length > 0 ? sorted[0].circleCount : 0;

  // Options in original round order with rank attached
  const options: ScheduleOptionSummary[] = optionSummariesUnranked.map(item => {
    const rank = rankedMap.get(item.option.id) || 1;
    const isBest =
      totalVoters > 0 &&
      rank === 1 &&
      (item.circleCount > 0 || item.triangleCount > 0) &&
      item.score === maxScore &&
      item.circleCount === maxCircles;

    return {
      ...item,
      rank,
      isBest,
    };
  });

  const bestOptions = options.filter(o => o.isBest);

  return {
    options,
    voters: voterRows,
    totalVoters,
    bestOptions,
  };
}

/**
 * Exports summary as plain text for easy sharing via chat/email.
 */
export function formatScheduleExportText(
  poll: Poll,
  round: PollRound,
  summary: ScheduleResultSummary,
  language: 'ja' | 'en' = 'ja'
): string {
  const isEn = language === 'en';
  const symCircle = getScheduleSymbol('circle', language);
  const symTriangle = getScheduleSymbol('triangle', language);
  const symCross = getScheduleSymbol('cross', language);

  const lines: string[] = [];
  lines.push(isEn ? `[Schedule Results] ${poll.title}` : `【日程調整結果】${poll.title}`);
  if (poll.description) {
    lines.push(`${poll.description}`);
  }
  lines.push(isEn ? `Total Respondents: ${summary.totalVoters}` : `回答者数: ${summary.totalVoters}名`);
  lines.push('----------------------------');

  if (summary.bestOptions.length > 0) {
    lines.push(isEn ? `★ Best Candidate Dates:` : `★ おすすめ候補日:`);
    summary.bestOptions.forEach(best => {
      lines.push(
        `  👑 ${best.option.text} (${symCircle}:${best.circleCount} / ${symTriangle}:${best.triangleCount} / ${symCross}:${best.crossCount})`
      );
    });
    lines.push('----------------------------');
  }

  lines.push(isEn ? '[Attendance by Date]' : '【日程別 出欠状況】');
  summary.options.forEach(optSummary => {
    const bestMark = optSummary.isBest ? '👑 ' : '';
    lines.push(
      `${bestMark}${optSummary.option.text} → ${symCircle}:${optSummary.circleCount} ${symTriangle}:${optSummary.triangleCount} ${symCross}:${optSummary.crossCount} (${isEn ? 'Total ' : '計'}${optSummary.score}pt)`
    );
  });

  if (summary.voters.length > 0) {
    lines.push('----------------------------');
    lines.push(isEn ? '[Participants]' : '【参加者一覧】');
    summary.voters.forEach(v => {
      const respStr = round.options
        .map(opt => {
          const choice = v.responses[opt.id];
          const sym = choice ? getScheduleSymbol(choice, language) : '-';
          return `${opt.text}: ${sym}`;
        })
        .join(' | ');
      const commentStr = v.comment ? ` (${isEn ? 'Comment: ' : 'コメント: '}${v.comment})` : '';
      lines.push(`・${v.userDisplayName}${commentStr}\n   [${respStr}]`);
    });
  }

  return lines.join('\n');
}

/**
 * Generates CSV string for schedule results.
 */
export function formatScheduleCsv(
  round: PollRound,
  summary: ScheduleResultSummary,
  language: 'ja' | 'en' = 'ja'
): string {
  const isEn = language === 'en';
  const symCircle = getScheduleSymbol('circle', language);
  const symTriangle = getScheduleSymbol('triangle', language);
  const symCross = getScheduleSymbol('cross', language);

  const header = [
    isEn ? '"Respondent"' : '"回答者"',
    ...round.options.map(o => `"${o.text.replace(/"/g, '""')}"`),
    isEn ? '"Comment"' : '"コメント"',
    isEn ? '"Date Submitted"' : '"回答日時"',
  ];
  const rows: string[][] = [header];

  summary.voters.forEach(v => {
    const row = [
      `"${v.userDisplayName.replace(/"/g, '""')}"`,
      ...round.options.map(opt => {
        const choice = v.responses[opt.id];
        return choice ? getScheduleSymbol(choice, language) : '-';
      }),
      `"${(v.comment || '').replace(/"/g, '""')}"`,
      `"${v.votedAt}"`,
    ];
    rows.push(row);
  });

  // Add Summary Rows
  rows.push([]);
  rows.push([
    isEn ? `[Total ${symCircle}]` : `【集計: ${symCircle}】`,
    ...round.options.map(opt => {
      const optSummary = summary.options.find(o => o.option.id === opt.id);
      return String(optSummary?.circleCount ?? 0);
    }),
    '',
    '',
  ]);

  rows.push([
    isEn ? `[Total ${symTriangle}]` : `【集計: ${symTriangle}】`,
    ...round.options.map(opt => {
      const optSummary = summary.options.find(o => o.option.id === opt.id);
      return String(optSummary?.triangleCount ?? 0);
    }),
    '',
    '',
  ]);

  rows.push([
    isEn ? `[Total ${symCross}]` : `【集計: ${symCross}】`,
    ...round.options.map(opt => {
      const optSummary = summary.options.find(o => o.option.id === opt.id);
      return String(optSummary?.crossCount ?? 0);
    }),
    '',
    '',
  ]);

  rows.push([
    isEn ? '[Score]' : '【スコア】',
    ...round.options.map(opt => {
      const optSummary = summary.options.find(o => o.option.id === opt.id);
      return String(optSummary?.score ?? 0);
    }),
    '',
    '',
  ]);

  return rows.map(r => r.join(',')).join('\n');
}
