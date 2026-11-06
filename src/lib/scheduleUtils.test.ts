import { describe, it, expect } from 'vitest';
import {
  parseScheduleCandidateLines,
  candidateLinesToOptions,
  getScheduleSymbol,
  calculateScheduleResults,
  formatScheduleExportText,
  formatScheduleCsv,
  parseCandidateDateInfo,
  sanitizeHttpUrl,
  formatDateInfo,
  buildDecisionFromOption,
  sortScheduleOptions,
  getSortedRoundOptions,
  mergeScheduleCandidates,
  classifyNewCandidateLines,
  ScheduleCandidateLimitError,
} from './scheduleUtils';
import { Poll, PollRound, Vote } from './types';

describe('scheduleUtils', () => {
  describe('sortScheduleOptions', () => {
    const ref = new Date(2026, 10, 1); // 2026-11-01
    const texts = (opts: { text: string }[]) => opts.map(o => o.text);

    it('sorts oldest first across months and year rollover', () => {
      const opts = ['1/5(火) 19:00〜', '12/24(木) 19:00〜', '11/30(月) 19:00〜'].map((text, i) => ({ id: `o${i}`, text }));
      expect(texts(sortScheduleOptions(opts, ref))).toEqual(['11/30(月) 19:00〜', '12/24(木) 19:00〜', '1/5(火) 19:00〜']);
    });

    it('puts all-day before timed on the same day, then by start time', () => {
      const opts = ['11/20 20:00〜', '11/20 9:30〜', '11/20 終日', '11/20 18:30〜'].map((text, i) => ({ id: `o${i}`, text }));
      expect(texts(sortScheduleOptions(opts, ref))).toEqual(['11/20 終日', '11/20 9:30〜', '11/20 18:30〜', '11/20 20:00〜']);
    });

    it('keeps unparseable options last in original order (stable)', () => {
      const opts = ['未定A', '11/21 19:00〜', '未定B', '11/21 19:00〜(2)', '11/10 19:00〜'].map((text, i) => ({ id: `o${i}`, text }));
      expect(texts(sortScheduleOptions(opts, ref))).toEqual(['11/10 19:00〜', '11/21 19:00〜', '11/21 19:00〜(2)', '未定A', '未定B']);
    });

    it('prefers stored dateInfo over text parsing', () => {
      const opts = [
        { id: 'a', text: 'Aの日', dateInfo: { date: '2026-12-01', allDay: true } },
        { id: 'b', text: 'Bの日', dateInfo: { date: '2026-11-15', startTime: '19:00' } },
      ];
      expect(sortScheduleOptions(opts, ref).map(o => o.id)).toEqual(['b', 'a']);
    });

    it('uses the round creation date as reference', () => {
      const round = {
        roundNumber: 1, title: '', maxChoices: 2, status: 'open' as const,
        startDate: '2026-12-20T00:00:00.000Z', endDate: '2027-01-30T00:00:00.000Z', createdAt: '2026-12-20T00:00:00.000Z',
        options: [{ id: 'jan', text: '1/10 19:00〜' }, { id: 'dec', text: '12/28 19:00〜' }],
      };
      expect(getSortedRoundOptions(round).map(o => o.id)).toEqual(['dec', 'jan']);
    });
  });

  describe('sorted results & exports', () => {
    const round = {
      roundNumber: 1, title: '', maxChoices: 3, status: 'open' as const,
      startDate: '2026-11-01T00:00:00.000Z', endDate: '2026-11-30T00:00:00.000Z', createdAt: '2026-11-01T00:00:00.000Z',
      options: [
        { id: 'c', text: '11/25 19:00〜' },
        { id: 'a', text: '11/5 19:00〜' },
        { id: 'b', text: '11/12 19:00〜' },
      ],
    };
    const votes = [
      { id: 'u1', userId: 'u1', userDisplayName: 'Taro', selectedOptionIds: ['a'], scheduleResponses: { a: 'circle' as const, b: 'cross' as const, c: 'triangle' as const }, votedAt: '2026-11-02T00:00:00.000Z' },
    ];

    it('orders summary options oldest first', () => {
      expect(calculateScheduleResults(round, votes).options.map(o => o.option.id)).toEqual(['a', 'b', 'c']);
    });

    it('orders CSV columns oldest first', () => {
      const csv = formatScheduleCsv(round, calculateScheduleResults(round, votes), 'ja');
      expect(csv.split('\n')[0]).toBe('"回答者","11/5 19:00〜","11/12 19:00〜","11/25 19:00〜","コメント","回答日時"');
      expect(csv.split('\n')[1].startsWith('"Taro",◯,✗,△')).toBe(true);
    });
  });

  describe('mergeScheduleCandidates', () => {
    const ref = new Date(2026, 10, 1);
    const existing = [
      { id: 'opt_sched_1_aaaaa', text: '11/20 19:00〜' },
      { id: 'opt_sched_2_bbbbb', text: '11/22 19:00〜' },
    ];

    it('adds new candidates sorted, skipping duplicates', () => {
      const r = mergeScheduleCandidates(existing, ['11/21 19:00〜', ' 11/20  19:00〜 ', '11/21 19:00〜', '11/19 終日'], ref);
      expect(r.added.map(o => o.text)).toEqual(['11/21 19:00〜', '11/19 終日']);
      expect(r.skipped).toHaveLength(2);
      expect(r.options.map(o => o.text)).toEqual(['11/19 終日', '11/20 19:00〜', '11/21 19:00〜', '11/22 19:00〜']);
      expect(r.added[0].dateInfo?.date).toBe('2026-11-21');
      const ids = r.options.map(o => o.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('enforces the 30 candidate limit', () => {
      const many = Array.from({ length: 29 }, (_, i) => ({ id: `x${i}`, text: `候補${i}` }));
      expect(mergeScheduleCandidates(many, ['A'], ref).options).toHaveLength(30);
      try {
        mergeScheduleCandidates(many, ['A', 'B'], ref);
        throw new Error('should throw');
      } catch (e) {
        expect(e).toBeInstanceOf(ScheduleCandidateLimitError);
        expect((e as ScheduleCandidateLimitError).remaining).toBe(1);
      }
    });

    it('classifies duplicates within input and against existing', () => {
      expect(classifyNewCandidateLines(existing, ['11/20 19:00〜', 'X', 'X', ''])).toEqual({
        newLines: ['X'],
        duplicateLines: ['11/20 19:00〜', 'X'],
      });
    });
  });

  describe('parseCandidateDateInfo', () => {
    const ref = new Date(2026, 7, 1); // 2026-08-01

    it('parses M/D(曜) HH:MM〜', () => {
      expect(parseCandidateDateInfo('8/25(火) 19:00〜', ref)).toEqual({
        date: '2026-08-25',
        startTime: '19:00',
        allDay: false,
      });
    });

    it('parses time ranges', () => {
      expect(parseCandidateDateInfo('8/25(火) 19:00〜21:30', ref)).toEqual({
        date: '2026-08-25',
        startTime: '19:00',
        endTime: '21:30',
        allDay: false,
      });
      expect(parseCandidateDateInfo('8/25 18:30-20:00', ref)?.endTime).toBe('20:00');
    });

    it('parses explicit years and Japanese 時 notation', () => {
      expect(parseCandidateDateInfo('2027/1/5 19時〜', ref)).toEqual({
        date: '2027-01-05',
        startTime: '19:00',
        allDay: false,
      });
      expect(parseCandidateDateInfo('2026年9月3日 12時30分〜', ref)?.startTime).toBe('12:30');
      expect(parseCandidateDateInfo('2026-09-03', ref)).toEqual({ date: '2026-09-03', allDay: true });
    });

    it('treats 終日 and date-only lines as all-day', () => {
      expect(parseCandidateDateInfo('8/25(火) 終日', ref)).toEqual({ date: '2026-08-25', allDay: true });
      expect(parseCandidateDateInfo('8月25日', ref)).toEqual({ date: '2026-08-25', allDay: true });
    });

    it('rolls dates before the reference date to next year', () => {
      expect(parseCandidateDateInfo('1/10(土) 19:00〜', new Date(2026, 10, 6))?.date).toBe('2027-01-10');
      expect(parseCandidateDateInfo('11/6 19:00〜', new Date(2026, 10, 6))?.date).toBe('2026-11-06');
    });

    it('returns null for unparseable or invalid dates', () => {
      expect(parseCandidateDateInfo('来週のどこか', ref)).toBeNull();
      expect(parseCandidateDateInfo('2026/2/30 19:00', ref)).toBeNull();
    });
  });

  describe('sanitizeHttpUrl', () => {
    it('accepts http(s) and adds https:// when missing', () => {
      expect(sanitizeHttpUrl('https://maps.app.goo.gl/abc')).toBe('https://maps.app.goo.gl/abc');
      expect(sanitizeHttpUrl('maps.app.goo.gl/abc')).toBe('https://maps.app.goo.gl/abc');
    });

    it('rejects dangerous or invalid URLs', () => {
      expect(sanitizeHttpUrl('javascript:alert(1)')).toBe('');
      expect(sanitizeHttpUrl('data:text/html,hi')).toBe('');
      expect(sanitizeHttpUrl('not a url')).toBe('');
      expect(sanitizeHttpUrl('')).toBe('');
    });
  });

  describe('formatDateInfo / buildDecisionFromOption', () => {
    it('formats in Japanese', () => {
      expect(formatDateInfo({ date: '2026-08-25', startTime: '19:00', endTime: '21:00' }, 'ja')).toBe(
        '2026/8/25(火) 19:00〜21:00'
      );
      expect(formatDateInfo({ date: '2026-08-25', allDay: true }, 'ja')).toBe('2026/8/25(火) 終日');
    });

    it('prefills a decision from option text when dateInfo is missing', () => {
      const d = buildDecisionFromOption({ id: 'o1', text: '8/25(火) 19:00〜' }, new Date(2026, 7, 1));
      expect(d).toEqual({ optionId: 'o1', label: '8/25(火) 19:00〜', date: '2026-08-25', startTime: '19:00', endTime: undefined, allDay: false });
    });
  });

  describe('parseScheduleCandidateLines', () => {
    it('should split multiline strings and ignore empty lines', () => {
      const raw = `
        8/25(月) 19:00〜
        8/26(火) 19:00〜

        8/27(水) 20:00〜
      `;
      const lines = parseScheduleCandidateLines(raw);
      expect(lines).toEqual([
        '8/25(月) 19:00〜',
        '8/26(火) 19:00〜',
        '8/27(水) 20:00〜',
      ]);
    });

    it('should return empty array for empty string', () => {
      expect(parseScheduleCandidateLines('')).toEqual([]);
    });
  });

  describe('candidateLinesToOptions', () => {
    it('should create PollOption objects with colors', () => {
      const lines = ['8/25(月)', '8/26(火)'];
      const options = candidateLinesToOptions(lines);
      expect(options).toHaveLength(2);
      expect(options[0].text).toBe('8/25(月)');
      expect(options[1].text).toBe('8/26(火)');
      expect(options[0].id).toBeTruthy();
      expect(options[0].color).toBeTruthy();
    });
  });

  describe('calculateScheduleResults', () => {
    const round: PollRound = {
      roundNumber: 1,
      title: '日程調整',
      startDate: '2026-08-25T10:00:00Z',
      endDate: '2026-08-30T10:00:00Z',
      maxChoices: 1,
      options: [
        { id: 'opt_1', text: '8/25(月) 19:00' },
        { id: 'opt_2', text: '8/26(火) 19:00' },
        { id: 'opt_3', text: '8/27(水) 19:00' },
      ],
      status: 'open',
    };

    it('should calculate counts, scores, and determine best option correctly', () => {
      const votes: Vote[] = [
        {
          id: 'user_1',
          userId: 'user_1',
          userDisplayName: 'Alice',
          selectedOptionIds: [],
          scheduleResponses: {
            opt_1: 'circle',
            opt_2: 'triangle',
            opt_3: 'cross',
          },
          comment: '月曜ならいつでも',
          votedAt: '2026-08-25T12:00:00Z',
        },
        {
          id: 'user_2',
          userId: 'user_2',
          userDisplayName: 'Bob',
          selectedOptionIds: [],
          scheduleResponses: {
            opt_1: 'circle',
            opt_2: 'circle',
            opt_3: 'triangle',
          },
          votedAt: '2026-08-25T13:00:00Z',
        },
        {
          id: 'user_3',
          userId: 'user_3',
          userDisplayName: 'Charlie',
          selectedOptionIds: [],
          scheduleResponses: {
            opt_1: 'circle',
            opt_2: 'cross',
            opt_3: 'cross',
          },
          votedAt: '2026-08-25T14:00:00Z',
        },
      ];

      const summary = calculateScheduleResults(round, votes);

      expect(summary.totalVoters).toBe(3);
      expect(summary.voters).toHaveLength(3);

      // opt_1: 3 circles -> score = 6, rank = 1
      const opt1 = summary.options.find(o => o.option.id === 'opt_1');
      expect(opt1?.circleCount).toBe(3);
      expect(opt1?.triangleCount).toBe(0);
      expect(opt1?.crossCount).toBe(0);
      expect(opt1?.score).toBe(6);
      expect(opt1?.rank).toBe(1);
      expect(opt1?.isBest).toBe(true);

      // opt_2: 1 circle, 1 triangle, 1 cross -> score = 3, rank = 2
      const opt2 = summary.options.find(o => o.option.id === 'opt_2');
      expect(opt2?.circleCount).toBe(1);
      expect(opt2?.triangleCount).toBe(1);
      expect(opt2?.crossCount).toBe(1);
      expect(opt2?.score).toBe(3);
      expect(opt2?.rank).toBe(2);
      expect(opt2?.isBest).toBe(false);

      // opt_3: 0 circle, 1 triangle, 2 cross -> score = 1, rank = 3
      const opt3 = summary.options.find(o => o.option.id === 'opt_3');
      expect(opt3?.circleCount).toBe(0);
      expect(opt3?.triangleCount).toBe(1);
      expect(opt3?.crossCount).toBe(2);
      expect(opt3?.score).toBe(1);
      expect(opt3?.rank).toBe(3);

      expect(summary.bestOptions).toHaveLength(1);
      expect(summary.bestOptions[0].option.id).toBe('opt_1');
    });
  });

  describe('formatScheduleExportText and CSV', () => {
    const poll: Poll = {
      id: 'poll_1',
      title: 'チーム歓迎会 日程調整',
      description: '場所: 渋谷周辺',
      creatorUid: 'user_1',
      creatorDisplayName: '幹事',
      createdAt: '2026-08-25T10:00:00Z',
      updatedAt: '2026-08-25T10:00:00Z',
      status: 'active',
      isPublicResult: true,
      requireAuth: false,
      showVoterNames: true,
      currentRound: 1,
      totalRounds: 1,
      pollType: 'schedule',
    };

    const round: PollRound = {
      roundNumber: 1,
      title: '日程調整',
      startDate: '2026-08-25T10:00:00Z',
      endDate: '2026-08-30T10:00:00Z',
      maxChoices: 1,
      options: [
        { id: 'opt_1', text: '8/25(月) 19:00〜' },
      ],
      status: 'open',
    };

    const votes: Vote[] = [
      {
        id: 'user_1',
        userId: 'user_1',
        userDisplayName: '田中',
        selectedOptionIds: [],
        scheduleResponses: { opt_1: 'circle' },
        comment: '楽しみです',
        votedAt: '2026-08-25T12:00:00Z',
      },
    ];

    it('should format export text correctly in Japanese', () => {
      const summary = calculateScheduleResults(round, votes);
      const text = formatScheduleExportText(poll, round, summary, 'ja');
      expect(text).toContain('【日程調整結果】チーム歓迎会 日程調整');
      expect(text).toContain('8/25(月) 19:00〜');
      expect(text).toContain('田中');
      expect(text).toContain('楽しみです');
      expect(text).toContain('◯:1');
    });

    it('should format export text correctly in English', () => {
      const summary = calculateScheduleResults(round, votes);
      const text = formatScheduleExportText(poll, round, summary, 'en');
      expect(text).toContain('[Schedule Results] チーム歓迎会 日程調整');
      expect(text).toContain('8/25(月) 19:00〜');
      expect(text).toContain('田中');
      expect(text).toContain('Comment: 楽しみです');
      expect(text).toContain('✓:1');
    });

    it('should format CSV correctly in Japanese and English', () => {
      const summary = calculateScheduleResults(round, votes);
      const csvJa = formatScheduleCsv(round, summary, 'ja');
      expect(csvJa).toContain('"回答者","8/25(月) 19:00〜","コメント","回答日時"');
      expect(csvJa).toContain('"田中",◯,"楽しみです"');

      const csvEn = formatScheduleCsv(round, summary, 'en');
      expect(csvEn).toContain('"Respondent","8/25(月) 19:00〜","Comment","Date Submitted"');
      expect(csvEn).toContain('"田中",✓,"楽しみです"');
    });

    it('should map symbols correctly according to language', () => {
      expect(getScheduleSymbol('circle', 'ja')).toBe('◯');
      expect(getScheduleSymbol('triangle', 'ja')).toBe('△');
      expect(getScheduleSymbol('cross', 'ja')).toBe('✗');

      expect(getScheduleSymbol('circle', 'en')).toBe('✓');
      expect(getScheduleSymbol('triangle', 'en')).toBe('?');
      expect(getScheduleSymbol('cross', 'en')).toBe('✕');
    });
  });
});
