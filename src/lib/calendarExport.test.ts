import { describe, it, expect } from 'vitest';
import {
  buildIcs,
  buildGoogleCalendarUrl,
  computeEventRange,
  escapeIcsText,
  foldIcsLine,
  toUtcBasic,
} from './calendarExport';
import { Poll, ScheduleDecision } from './types';

const poll: Poll = {
  id: 'poll_abc',
  title: '歓送迎会, 2026',
  description: '一次会; 二次会あり\n詳細は追って',
  creatorUid: 'u1',
  creatorDisplayName: 'Admin',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  status: 'active',
  isPublicResult: true,
  requireAuth: false,
  showVoterNames: true,
  currentRound: 1,
  totalRounds: 1,
  pollType: 'schedule',
  location: '渋谷 〇〇居酒屋',
  locationUrl: 'https://maps.example.com/abc',
  fee: '4,000円',
};

const timed: ScheduleDecision = {
  optionId: 'opt_1',
  label: '8/25(火) 19:00〜',
  date: '2026-08-25',
  startTime: '19:00',
  allDay: false,
  decidedAt: '2026-08-10T00:00:00.000Z',
};

describe('calendarExport', () => {
  it('computes timed ranges in UTC with a 2h default duration', () => {
    const range = computeEventRange(timed);
    expect(range.allDay).toBe(false);
    expect(range.start).toBe(toUtcBasic(new Date(2026, 7, 25, 19, 0)));
    expect(range.end).toBe(toUtcBasic(new Date(2026, 7, 25, 21, 0)));
  });

  it('rolls an end time before the start time to the next day', () => {
    const range = computeEventRange({ ...timed, startTime: '22:00', endTime: '01:00' });
    expect(range.end).toBe(toUtcBasic(new Date(2026, 7, 26, 1, 0)));
  });

  it('computes all-day ranges with an exclusive end date', () => {
    expect(computeEventRange({ date: '2026-12-31', allDay: true })).toEqual({
      allDay: true,
      start: '20261231',
      end: '20270101',
    });
  });

  it('escapes iCalendar text values', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('folds lines longer than 75 octets without splitting multibyte chars', () => {
    const line = 'DESCRIPTION:' + 'あ'.repeat(40);
    const folded = foldIcsLine(line);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    const enc = new TextEncoder();
    parts.forEach(p => expect(enc.encode(p).length).toBeLessThanOrEqual(75));
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(line);
  });

  it('builds a valid VEVENT', () => {
    const ics = buildIcs(poll, timed, 'https://votica.example/#/poll/poll_abc', 'ja', new Date(Date.UTC(2026, 7, 10)));
    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('UID:poll_abc-opt_1@votica');
    expect(ics).toContain('DTSTAMP:20260810T000000Z');
    expect(ics).toContain('SUMMARY:歓送迎会\\, 2026');
    expect(ics).toContain('LOCATION:渋谷 〇〇居酒屋');
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('uses VALUE=DATE for all-day events', () => {
    const ics = buildIcs(poll, { ...timed, allDay: true, startTime: undefined }, undefined);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260825');
    expect(ics).toContain('DTEND;VALUE=DATE:20260826');
  });

  it('builds a Google Calendar template URL', () => {
    const url = new URL(buildGoogleCalendarUrl(poll, { ...timed, allDay: true }, 'https://votica.example/'));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe(poll.title);
    expect(url.searchParams.get('dates')).toBe('20260825/20260826');
    expect(url.searchParams.get('location')).toBe(poll.location);
    expect(url.searchParams.get('details')).toContain('会費: 4,000円');
    expect(url.searchParams.get('details')).toContain('https://maps.example.com/abc');
  });

  it('drops unsafe map URLs from details', () => {
    const url = new URL(
      buildGoogleCalendarUrl({ ...poll, location: '', locationUrl: 'javascript:alert(1)' }, timed)
    );
    expect(url.searchParams.get('details') || '').not.toContain('javascript');
    expect(url.searchParams.get('location')).toBeNull();
  });
});
