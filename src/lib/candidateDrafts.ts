/**
 * Pure helpers for the schedule candidate picker.
 * A draft is one candidate line ("11/20(金)" / "11/20(金) 19:00〜") with optional structured date & time.
 */
import { formatQuickDate, parseCandidateDateInfo, sortScheduleOptions } from './scheduleUtils';

export interface CandidateDraft {
  id: string;
  /** YYYY-MM-DD (undefined for free-text lines whose date cannot be parsed) */
  date?: string;
  /** Time label such as "19:00〜" / "終日". '' = date only. undefined = custom free text */
  time?: string;
  text: string;
}

/** Time slot templates offered in "time" mode */
export const TIME_SLOT_TEMPLATES = ['12:00〜', '18:30〜', '19:00〜', '20:00〜', '終日'];

/** All half-hour time options plus "終日" for the custom select */
export const ALL_TIME_OPTIONS: string[] = (() => {
  const list: string[] = [];
  for (let h = 0; h < 24; h++) {
    list.push(`${h}:00〜`, `${h}:30〜`);
  }
  list.push('終日');
  return list;
})();

const pad2 = (n: number) => String(n).padStart(2, '0');

export const ymdKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const keyToDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

let seq = 0;
const newId = () => `draft_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export const draftText = (date: string, time: string) => formatQuickDate(keyToDate(date), time);

export function makeDraft(date: string, time: string): CandidateDraft {
  return { id: newId(), date, time, text: draftText(date, time) };
}

const normalize = (text: string) => text.trim().replace(/\s+/g, ' ');

export interface DraftUpdate {
  drafts: CandidateDraft[];
  /** true when some candidates were not added because of the max limit */
  limited: boolean;
}

/**
 * Adds candidates for each (date x slot). Duplicates (same text, also against `excludeTexts`) are skipped.
 * `slots` = [''] means date-only.
 */
export function addDates(
  drafts: CandidateDraft[],
  dates: string[],
  slots: string[],
  max: number,
  excludeTexts: string[] = []
): DraftUpdate {
  const seen = new Set([...drafts.map(d => normalize(d.text)), ...excludeTexts.map(normalize)]);
  const next = [...drafts];
  let limited = false;
  const effectiveSlots = slots.length > 0 ? slots : [''];
  for (const date of dates) {
    for (const slot of effectiveSlots) {
      const draft = makeDraft(date, slot);
      const key = normalize(draft.text);
      if (seen.has(key)) continue;
      if (next.length >= max) {
        limited = true;
        continue;
      }
      seen.add(key);
      next.push(draft);
    }
  }
  return { drafts: next, limited };
}

/** Removes every candidate on the given dates. */
export function removeDates(drafts: CandidateDraft[], dates: string[]): CandidateDraft[] {
  const set = new Set(dates);
  return drafts.filter(d => !d.date || !set.has(d.date));
}

/** Toggles a calendar date: removes its candidates if any exist, otherwise adds one per slot. */
export function toggleDate(
  drafts: CandidateDraft[],
  date: string,
  slots: string[],
  max: number,
  excludeTexts: string[] = []
): DraftUpdate {
  if (drafts.some(d => d.date === date)) {
    return { drafts: removeDates(drafts, [date]), limited: false };
  }
  return addDates(drafts, [date], slots, max, excludeTexts);
}

/** Changes the time of one candidate. Ignored when it would duplicate another candidate. */
export function changeDraftTime(
  drafts: CandidateDraft[],
  id: string,
  time: string,
  excludeTexts: string[] = []
): CandidateDraft[] {
  const target = drafts.find(d => d.id === id);
  if (!target || !target.date) return drafts;
  const text = draftText(target.date, time);
  const taken = new Set([
    ...drafts.filter(d => d.id !== id).map(d => normalize(d.text)),
    ...excludeTexts.map(normalize),
  ]);
  if (taken.has(normalize(text))) return drafts;
  return drafts.map(d => (d.id === id ? { ...d, time, text } : d));
}

/** Adds another candidate on the same date with the first unused time slot. */
export function duplicateDraftWithNewTime(
  drafts: CandidateDraft[],
  id: string,
  max: number,
  excludeTexts: string[] = []
): DraftUpdate {
  const target = drafts.find(d => d.id === id);
  if (!target || !target.date) return { drafts, limited: false };
  if (drafts.length >= max) return { drafts, limited: true };
  const taken = new Set([...drafts.map(d => normalize(d.text)), ...excludeTexts.map(normalize)]);
  const candidates = [...TIME_SLOT_TEMPLATES.filter(s => s !== '終日'), ...ALL_TIME_OPTIONS];
  const slot = candidates.find(s => !taken.has(normalize(draftText(target.date!, s))));
  if (!slot) return { drafts, limited: false };
  const index = drafts.findIndex(d => d.id === id);
  const next = [...drafts];
  next.splice(index + 1, 0, makeDraft(target.date, slot));
  return { drafts: next, limited: false };
}

export function removeDraft(drafts: CandidateDraft[], id: string): CandidateDraft[] {
  return drafts.filter(d => d.id !== id);
}

/** Converts free-text lines into drafts (dates are parsed so the calendar can highlight them). */
export function draftsFromLines(lines: string[], refDate: Date = new Date()): CandidateDraft[] {
  const seen = new Set<string>();
  const result: CandidateDraft[] = [];
  for (const raw of lines) {
    const text = raw.trim();
    if (!text || seen.has(normalize(text))) continue;
    seen.add(normalize(text));
    const info = parseCandidateDateInfo(text, refDate);
    let time: string | undefined;
    if (info) {
      const prefix = draftText(info.date, '');
      if (text === prefix) time = '';
      else if (text.startsWith(prefix + ' ')) {
        const rest = text.slice(prefix.length + 1).trim();
        if (ALL_TIME_OPTIONS.includes(rest) || TIME_SLOT_TEMPLATES.includes(rest)) time = rest;
      }
    }
    result.push({ id: newId(), date: info?.date, time, text });
  }
  return result;
}

export const linesFromDrafts = (drafts: CandidateDraft[]) => drafts.map(d => d.text);

/** Drafts sorted oldest first (same order as the saved options). */
export function sortDrafts(drafts: CandidateDraft[], refDate: Date = new Date()): CandidateDraft[] {
  const byId = new Map(drafts.map(d => [d.id, d]));
  return sortScheduleOptions(
    drafts.map(d => ({ id: d.id, text: d.text })),
    refDate
  ).map(o => byId.get(o.id)!);
}

/** Number of candidates per date (for calendar markers). */
export function countByDate(drafts: Array<Pick<CandidateDraft, 'date'>>): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of drafts) {
    if (d.date) map.set(d.date, (map.get(d.date) || 0) + 1);
  }
  return map;
}

export type DatePreset = 'next7' | 'weekend' | 'nextWeekdays';

/** Date keys for quick presets. */
export function presetDates(preset: DatePreset, now: Date = new Date()): string[] {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const addDays = (n: number) => ymdKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + n));
  const day = base.getDay();
  if (preset === 'next7') {
    return Array.from({ length: 7 }, (_, i) => addDays(i));
  }
  if (preset === 'weekend') {
    // Upcoming Saturday & Sunday (Saturday itself counts as "this weekend")
    const diffSat = (6 - day + 7) % 7;
    return [addDays(diffSat), addDays(diffSat + 1)];
  }
  const diffMon = (1 - day + 7) % 7 || 7;
  return Array.from({ length: 5 }, (_, i) => addDays(diffMon + i));
}

/** Inclusive list of date keys between two keys (order independent). */
export function dateRange(a: string, b: string): string[] {
  const [start, end] = a <= b ? [a, b] : [b, a];
  const out: string[] = [];
  const cur = keyToDate(start);
  const last = keyToDate(end).getTime();
  while (cur.getTime() <= last && out.length < 400) {
    out.push(ymdKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
