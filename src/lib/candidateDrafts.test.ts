import { describe, it, expect } from 'vitest';
import {
  addDates,
  changeDraftTime,
  countByDate,
  dateRange,
  draftsFromLines,
  duplicateDraftWithNewTime,
  linesFromDrafts,
  presetDates,
  removeDates,
  sortDrafts,
  toggleDate,
} from './candidateDrafts';
import { formatQuickDate } from './scheduleUtils';

const texts = (d: { text: string }[]) => d.map(x => x.text);

describe('candidateDrafts', () => {
  it('formats date-only candidates without trailing space', () => {
    expect(formatQuickDate(new Date(2026, 10, 20), '')).toBe('11/20(金)');
    expect(formatQuickDate(new Date(2026, 10, 20), '19:00〜')).toBe('11/20(金) 19:00〜');
  });

  it('toggles a date on and off (date only)', () => {
    const on = toggleDate([], '2026-11-20', [''], 30);
    expect(texts(on.drafts)).toEqual(['11/20(金)']);
    expect(on.drafts[0]).toMatchObject({ date: '2026-11-20', time: '' });
    expect(toggleDate(on.drafts, '2026-11-20', [''], 30).drafts).toEqual([]);
  });

  it('creates one candidate per time slot', () => {
    const r = addDates([], ['2026-11-20', '2026-11-21'], ['19:00〜', '終日'], 30);
    expect(texts(r.drafts)).toEqual(['11/20(金) 19:00〜', '11/20(金) 終日', '11/21(土) 19:00〜', '11/21(土) 終日']);
  });

  it('skips duplicates (including existing texts) and respects the limit', () => {
    const r = addDates([], ['2026-11-20', '2026-11-21', '2026-11-22'], [''], 2, ['11/21(土)']);
    expect(texts(r.drafts)).toEqual(['11/20(金)', '11/22(日)']);
    expect(r.limited).toBe(false);
    const r2 = addDates(r.drafts, ['2026-11-23'], [''], 2);
    expect(r2.drafts).toHaveLength(2);
    expect(r2.limited).toBe(true);
  });

  it('changes time per row and refuses duplicates', () => {
    const { drafts } = addDates([], ['2026-11-20'], ['19:00〜', '20:00〜'], 30);
    const changed = changeDraftTime(drafts, drafts[0].id, '18:30〜');
    expect(texts(changed)).toEqual(['11/20(金) 18:30〜', '11/20(金) 20:00〜']);
    expect(changeDraftTime(drafts, drafts[0].id, '20:00〜')).toBe(drafts);
    expect(texts(changeDraftTime(drafts, drafts[0].id, ''))[0]).toBe('11/20(金)');
  });

  it('duplicates a row with another unused time', () => {
    const { drafts } = addDates([], ['2026-11-20'], ['12:00〜'], 30);
    const r = duplicateDraftWithNewTime(drafts, drafts[0].id, 30);
    expect(texts(r.drafts)).toEqual(['11/20(金) 12:00〜', '11/20(金) 18:30〜']);
  });

  it('converts text lines to drafts and back', () => {
    const ref = new Date(2026, 10, 1);
    const drafts = draftsFromLines(['11/20(金) 19:00〜', '11/21(土)', '未定の日', '11/20(金) 19:00〜'], ref);
    expect(drafts.map(d => [d.date, d.time])).toEqual([
      ['2026-11-20', '19:00〜'],
      ['2026-11-21', ''],
      [undefined, undefined],
    ]);
    expect(linesFromDrafts(drafts)).toEqual(['11/20(金) 19:00〜', '11/21(土)', '未定の日']);
    expect(countByDate(drafts).get('2026-11-20')).toBe(1);
  });

  it('sorts drafts oldest first and removes dates', () => {
    const { drafts } = addDates([], ['2026-11-22', '2026-11-20'], ['20:00〜', '19:00〜'], 30);
    expect(texts(sortDrafts(drafts, new Date(2026, 10, 1)))).toEqual([
      '11/20(金) 19:00〜',
      '11/20(金) 20:00〜',
      '11/22(日) 19:00〜',
      '11/22(日) 20:00〜',
    ]);
    expect(texts(removeDates(drafts, ['2026-11-22']))).toEqual(['11/20(金) 20:00〜', '11/20(金) 19:00〜']);
  });

  it('builds preset dates and ranges', () => {
    const fri = new Date(2026, 10, 6); // Fri 2026-11-06
    expect(presetDates('weekend', fri)).toEqual(['2026-11-07', '2026-11-08']);
    expect(presetDates('nextWeekdays', fri)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
    expect(presetDates('next7', fri)).toHaveLength(7);
    expect(presetDates('nextWeekdays', new Date(2026, 10, 9))[0]).toBe('2026-11-16'); // Monday -> next week
    expect(dateRange('2026-11-30', '2026-12-02')).toEqual(['2026-11-30', '2026-12-01', '2026-12-02']);
    expect(dateRange('2026-12-02', '2026-11-30')).toEqual(['2026-11-30', '2026-12-01', '2026-12-02']);
  });
});
