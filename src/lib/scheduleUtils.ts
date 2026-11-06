import { Poll, PollRound, PollOption, Vote, ScheduleChoice, ScheduleOptionSummary, ScheduleVoterRow, ScheduleResultSummary, ScheduleDateInfo, ScheduleDecision } from './types';
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
 * Each option gets a best-effort structured `dateInfo` (used for calendar export).
 */
export function candidateLinesToOptions(
  lines: string[],
  refDate: Date = new Date(),
  startIndex = 0
): PollOption[] {
  return lines.map((line, i) => {
    const idx = startIndex + i;
    const option: PollOption = {
      id: `opt_sched_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`,
      text: line,
      color: getOptionColor(idx),
    };
    const info = parseCandidateDateInfo(line, refDate);
    if (info) option.dateInfo = info;
    return option;
  });
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function toYmd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

const TIME_RE = /(\d{1,2})(?::(\d{2})|時(?:(\d{1,2})分?)?)/;
const RANGE_SEP_RE = /^\s*[〜~～\-–—ー]\s*/;

function parseTimeAt(text: string): { time: string; rest: string } | null {
  const m = text.match(TIME_RE);
  if (!m || m.index === undefined) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? m[3] ?? 0);
  if (h > 24 || min > 59) return null;
  return { time: `${pad2(h)}:${pad2(min)}`, rest: text.slice(m.index + m[0].length) };
}

/**
 * Best-effort parser for candidate lines such as
 *   "8/25(月) 19:00〜", "8/25(月) 19:00〜21:00", "2026/8/25 19時〜", "8月25日 終日", "2026-08-25".
 * When the year is omitted, the nearest date on or after `refDate` is used.
 * Lines without a time are treated as all-day. Returns null if no date is found.
 */
export function parseCandidateDateInfo(text: string, refDate: Date = new Date()): ScheduleDateInfo | null {
  if (!text) return null;
  const dateMatch = text.match(/(?:(\d{4})\s*[\/\-年.]\s*)?(\d{1,2})\s*[\/\-月.]\s*(\d{1,2})\s*日?/);
  if (!dateMatch || dateMatch.index === undefined) return null;

  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  let year: number;
  if (dateMatch[1]) {
    year = Number(dateMatch[1]);
    if (!isValidYmd(year, month, day)) return null;
  } else {
    year = refDate.getFullYear();
    const refDay = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()).getTime();
    // Try this year, then next years (handles 2/29 too)
    let found = false;
    for (let i = 0; i < 8; i++) {
      const y = year + i;
      if (isValidYmd(y, month, day) && new Date(y, month - 1, day).getTime() >= refDay) {
        year = y;
        found = true;
        break;
      }
    }
    if (!found) return null;
  }

  const date = toYmd(year, month, day);
  const rest = text.slice(dateMatch.index + dateMatch[0].length);

  if (/終日|all[\s-]?day/i.test(rest)) {
    return { date, allDay: true };
  }

  const start = parseTimeAt(rest);
  if (!start) {
    return { date, allDay: true };
  }

  const info: ScheduleDateInfo = { date, startTime: start.time, allDay: false };
  const sep = start.rest.match(RANGE_SEP_RE);
  if (sep) {
    const end = parseTimeAt(start.rest.slice(sep[0].length));
    if (end && start.rest.slice(sep[0].length).search(TIME_RE) === 0) {
      info.endTime = end.time;
    }
  }
  return info;
}

/**
 * Reference date used to interpret year-less candidate text of a round
 * (same basis as at creation time).
 */
export function getRoundRefDate(round: Pick<PollRound, 'createdAt' | 'startDate'>): Date {
  const d = new Date(round.createdAt || round.startDate || Date.now());
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Sort key for a schedule option: "YYYY-MM-DD|0" for all-day, "YYYY-MM-DD|1HH:mm" for timed.
 * Returns null when the date cannot be determined.
 */
function scheduleOptionSortKey(option: PollOption, refDate: Date): string | null {
  const info = option.dateInfo || parseCandidateDateInfo(option.text, refDate);
  if (!info) return null;
  if (info.allDay || !info.startTime) return `${info.date}|0`;
  return `${info.date}|1${info.startTime}`;
}

/**
 * Returns a new array of schedule options sorted oldest first.
 * Same day: all-day first, then by start time. Options whose date cannot be parsed
 * go last. The sort is stable (ties keep the original order).
 */
export function sortScheduleOptions(options: PollOption[], refDate: Date = new Date()): PollOption[] {
  return options
    .map((option, index) => ({ option, index, key: scheduleOptionSortKey(option, refDate) }))
    .sort((a, b) => {
      if (a.key === null && b.key === null) return a.index - b.index;
      if (a.key === null) return 1;
      if (b.key === null) return -1;
      if (a.key !== b.key) return a.key < b.key ? -1 : 1;
      return a.index - b.index;
    })
    .map(item => item.option);
}

/** Maximum number of candidate dates per schedule poll. */
export const MAX_SCHEDULE_CANDIDATES = 30;

const normalizeCandidateText = (text: string) => text.trim().replace(/\s+/g, ' ');

/**
 * Classifies new candidate lines against existing options:
 * - `newLines`: lines to add (deduplicated, in input order)
 * - `duplicateLines`: lines that already exist (or repeat within the input)
 */
export function classifyNewCandidateLines(
  existing: PollOption[],
  lines: string[]
): { newLines: string[]; duplicateLines: string[] } {
  const seen = new Set(existing.map(o => normalizeCandidateText(o.text)));
  const newLines: string[] = [];
  const duplicateLines: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const key = normalizeCandidateText(line);
    if (seen.has(key)) {
      duplicateLines.push(line);
    } else {
      seen.add(key);
      newLines.push(line);
    }
  }
  return { newLines, duplicateLines };
}

export class ScheduleCandidateLimitError extends Error {
  constructor(public readonly remaining: number) {
    super(`候補日程は最大${MAX_SCHEDULE_CANDIDATES}件までです`);
    this.name = 'ScheduleCandidateLimitError';
  }
}

/**
 * Appends new candidate lines to existing options and returns the merged list sorted oldest first.
 * Duplicates are skipped. Throws ScheduleCandidateLimitError when the total would exceed the limit.
 */
export function mergeScheduleCandidates(
  existing: PollOption[],
  lines: string[],
  refDate: Date = new Date()
): { options: PollOption[]; added: PollOption[]; skipped: string[] } {
  const { newLines, duplicateLines } = classifyNewCandidateLines(existing, lines);
  if (existing.length + newLines.length > MAX_SCHEDULE_CANDIDATES) {
    throw new ScheduleCandidateLimitError(Math.max(0, MAX_SCHEDULE_CANDIDATES - existing.length));
  }
  const usedIds = new Set(existing.map(o => o.id));
  const added = candidateLinesToOptions(newLines, refDate, existing.length).map(opt => {
    let id = opt.id;
    while (usedIds.has(id)) {
      id = `${opt.id}_${Math.random().toString(36).substring(2, 5)}`;
    }
    usedIds.add(id);
    return { ...opt, id };
  });
  return {
    options: sortScheduleOptions([...existing, ...added], refDate),
    added,
    skipped: duplicateLines,
  };
}

/** Round options sorted oldest first (using the round's reference date). */
export function getSortedRoundOptions(round: PollRound): PollOption[] {
  return sortScheduleOptions(round.options, getRoundRefDate(round));
}

/**
 * Formats a decision / dateInfo into a human-readable string.
 * ja: "2026/8/25(火) 19:00〜21:00", en: "Tue, Aug 25, 2026 19:00–21:00"
 */
export function formatDateInfo(
  info: Pick<ScheduleDateInfo, 'date' | 'startTime' | 'endTime' | 'allDay'>,
  language: 'ja' | 'en' = 'ja'
): string {
  const [y, m, d] = info.date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  let datePart: string;
  if (language === 'en') {
    datePart = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } else {
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    datePart = `${y}/${m}/${d}(${dayNames[dt.getDay()]})`;
  }
  if (info.allDay || !info.startTime) {
    return `${datePart} ${language === 'en' ? 'All day' : '終日'}`;
  }
  const sep = language === 'en' ? '–' : '〜';
  return `${datePart} ${info.startTime}${sep}${info.endTime || ''}`;
}

/**
 * Normalizes a user-entered URL. Only http(s) URLs are accepted (blocks `javascript:` etc.).
 * A URL without a scheme gets `https://` prepended. Returns '' when invalid.
 */
export function sanitizeHttpUrl(raw: string | undefined | null): string {
  if (!raw) return '';
  let value = raw.trim();
  if (!value) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    value = 'https://' + value;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    if (!url.hostname || !url.hostname.includes('.')) return '';
    return url.href;
  } catch {
    return '';
  }
}

/**
 * Builds the default decision (prefilled form values) for an option.
 */
export function buildDecisionFromOption(
  option: PollOption,
  refDate: Date = new Date()
): Omit<ScheduleDecision, 'decidedAt'> {
  const info = option.dateInfo || parseCandidateDateInfo(option.text, refDate);
  return {
    optionId: option.id,
    label: option.text,
    date: info?.date || toYmd(refDate.getFullYear(), refDate.getMonth() + 1, refDate.getDate()),
    startTime: info?.startTime,
    endTime: info?.endTime,
    allDay: info ? Boolean(info.allDay || !info.startTime) : true,
  };
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
  const sortedOptions = getSortedRoundOptions(round);
  // Keep the color assigned by the original position
  const originalIndex = new Map(round.options.map((opt, idx) => [opt.id, idx]));

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
      isAnonymous: v.isAnonymous,
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
  }> = sortedOptions.map(opt => {
    const idx = originalIndex.get(opt.id) ?? 0;
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
  if (poll.decision) {
    lines.push(
      isEn
        ? `✅ Confirmed: ${formatDateInfo(poll.decision, language)} (${poll.decision.label})`
        : `✅ 開催決定: ${formatDateInfo(poll.decision, language)}（${poll.decision.label}）`
    );
  }
  if (poll.description) {
    lines.push(`${poll.description}`);
  }
  if (poll.location) lines.push(`${isEn ? 'Location' : '場所'}: ${poll.location}`);
  const mapUrl = sanitizeHttpUrl(poll.locationUrl);
  if (mapUrl) lines.push(`${isEn ? 'Map / URL' : '地図・URL'}: ${mapUrl}`);
  if (poll.fee) lines.push(`${isEn ? 'Fee' : '会費'}: ${poll.fee}`);
  if (poll.notes) lines.push(`${isEn ? 'Notes' : '備考'}: ${poll.notes}`);
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
      const respStr = getSortedRoundOptions(round)
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
  const sortedOptions = getSortedRoundOptions(round);

  const header = [
    isEn ? '"Respondent"' : '"回答者"',
    ...sortedOptions.map(o => `"${o.text.replace(/"/g, '""')}"`),
    isEn ? '"Comment"' : '"コメント"',
    isEn ? '"Date Submitted"' : '"回答日時"',
  ];
  const rows: string[][] = [header];

  summary.voters.forEach(v => {
    const row = [
      `"${v.userDisplayName.replace(/"/g, '""')}"`,
      ...sortedOptions.map(opt => {
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
    ...sortedOptions.map(opt => {
      const optSummary = summary.options.find(o => o.option.id === opt.id);
      return String(optSummary?.circleCount ?? 0);
    }),
    '',
    '',
  ]);

  rows.push([
    isEn ? `[Total ${symTriangle}]` : `【集計: ${symTriangle}】`,
    ...sortedOptions.map(opt => {
      const optSummary = summary.options.find(o => o.option.id === opt.id);
      return String(optSummary?.triangleCount ?? 0);
    }),
    '',
    '',
  ]);

  rows.push([
    isEn ? `[Total ${symCross}]` : `【集計: ${symCross}】`,
    ...sortedOptions.map(opt => {
      const optSummary = summary.options.find(o => o.option.id === opt.id);
      return String(optSummary?.crossCount ?? 0);
    }),
    '',
    '',
  ]);

  rows.push([
    isEn ? '[Score]' : '【スコア】',
    ...sortedOptions.map(opt => {
      const optSummary = summary.options.find(o => o.option.id === opt.id);
      return String(optSummary?.score ?? 0);
    }),
    '',
    '',
  ]);

  return rows.map(r => r.join(',')).join('\n');
}
