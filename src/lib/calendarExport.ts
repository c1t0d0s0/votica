import { Poll, ScheduleDecision } from './types';
import { sanitizeHttpUrl } from './scheduleUtils';

const DEFAULT_DURATION_MINUTES = 120;

const pad2 = (n: number) => String(n).padStart(2, '0');

function parseYmd(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

function parseHm(time: string): [number, number] {
  const [h, m] = time.split(':').map(Number);
  return [h, m || 0];
}

/** Formats a Date as UTC basic format: 20260825T100000Z */
export function toUtcBasic(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  );
}

function toDateBasic(y: number, m: number, d: number): string {
  return `${y}${pad2(m)}${pad2(d)}`;
}

export interface EventRange {
  allDay: boolean;
  /** all-day: YYYYMMDD (start inclusive, end exclusive). timed: UTC basic format */
  start: string;
  end: string;
}

/**
 * Computes the event start/end from a decision (decision times are local time of the viewer's browser).
 * Timed events without end time default to 2 hours. An end time earlier than start rolls to the next day.
 */
export function computeEventRange(decision: Pick<ScheduleDecision, 'date' | 'startTime' | 'endTime' | 'allDay'>): EventRange {
  const [y, m, d] = parseYmd(decision.date);

  if (decision.allDay || !decision.startTime) {
    const next = new Date(y, m - 1, d + 1);
    return {
      allDay: true,
      start: toDateBasic(y, m, d),
      end: toDateBasic(next.getFullYear(), next.getMonth() + 1, next.getDate()),
    };
  }

  const [sh, sm] = parseHm(decision.startTime);
  const start = new Date(y, m - 1, d, sh, sm);
  let end: Date;
  if (decision.endTime) {
    const [eh, em] = parseHm(decision.endTime);
    end = new Date(y, m - 1, d, eh, em);
    if (end.getTime() <= start.getTime()) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }
  } else {
    end = new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000);
  }
  return { allDay: false, start: toUtcBasic(start), end: toUtcBasic(end) };
}

/** Builds the plain-text event details (description, fee, notes, map URL, page URL). */
export function buildEventDetails(poll: Poll, pageUrl?: string, language: 'ja' | 'en' = 'ja'): string {
  const isEn = language === 'en';
  const parts: string[] = [];
  if (poll.description) parts.push(poll.description);
  if (poll.fee) parts.push(`${isEn ? 'Fee' : '会費'}: ${poll.fee}`);
  if (poll.notes) parts.push(`${isEn ? 'Notes' : '備考'}: ${poll.notes}`);
  const mapUrl = sanitizeHttpUrl(poll.locationUrl);
  if (mapUrl) parts.push(`${isEn ? 'Map / URL' : '地図・URL'}: ${mapUrl}`);
  if (pageUrl) parts.push(`Votica: ${pageUrl}`);
  return parts.join('\n');
}

/** Location string for calendars: location name, or the map URL when no name is given. */
export function buildEventLocation(poll: Poll): string {
  return poll.location?.trim() || sanitizeHttpUrl(poll.locationUrl) || '';
}

/** Escapes TEXT values per RFC 5545 §3.3.11 */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Folds a content line to max 75 octets (UTF-8), continuation lines start with a space. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const ch of line) {
    const chBytes = encoder.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines have a leading space
    if (currentBytes + chBytes > limit) {
      out.push(current);
      current = '';
      currentBytes = 0;
    }
    current += ch;
    currentBytes += chBytes;
  }
  if (current) out.push(current);
  return out.join('\r\n ');
}

/**
 * Builds an iCalendar (.ics) document for the confirmed schedule.
 */
export function buildIcs(
  poll: Poll,
  decision: ScheduleDecision,
  pageUrl?: string,
  language: 'ja' | 'en' = 'ja',
  now: Date = new Date()
): string {
  const range = computeEventRange(decision);
  const details = buildEventDetails(poll, pageUrl, language);
  const location = buildEventLocation(poll);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Votica//Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${poll.id}-${decision.optionId}@votica`,
    `DTSTAMP:${toUtcBasic(now)}`,
    range.allDay ? `DTSTART;VALUE=DATE:${range.start}` : `DTSTART:${range.start}`,
    range.allDay ? `DTEND;VALUE=DATE:${range.end}` : `DTEND:${range.end}`,
    `SUMMARY:${escapeIcsText(poll.title)}`,
  ];
  if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
  if (details) lines.push(`DESCRIPTION:${escapeIcsText(details)}`);
  if (pageUrl) lines.push(`URL:${pageUrl}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/**
 * Builds a Google Calendar "add event" template URL (no OAuth required).
 */
export function buildGoogleCalendarUrl(
  poll: Poll,
  decision: ScheduleDecision,
  pageUrl?: string,
  language: 'ja' | 'en' = 'ja'
): string {
  const range = computeEventRange(decision);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: poll.title,
    dates: `${range.start}/${range.end}`,
  });
  const details = buildEventDetails(poll, pageUrl, language);
  if (details) params.set('details', details);
  const location = buildEventLocation(poll);
  if (location) params.set('location', location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Triggers a browser download of the .ics file. */
export function downloadIcs(filenameBase: string, ics: string): void {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenameBase.replace(/[\s/\\:*?"<>|]/g, '_') || 'event'}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
