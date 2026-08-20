import { describe, it, expect } from 'vitest';
import { calculateRoundResults, filterCandidatesForRunoff } from './runoffUtils';
import { PollRound, Vote } from './types';

describe('runoffUtils', () => {
  const dummyRound: PollRound = {
    roundNumber: 1,
    title: '第1回投票',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 86400000).toISOString(),
    maxChoices: 1,
    status: 'open',
    options: [
      { id: 'opt-1', text: '選択肢 A' },
      { id: 'opt-2', text: '選択肢 B' },
      { id: 'opt-3', text: '選択肢 C' },
    ],
  };

  it('should identify a single clear winner when there is no tie', () => {
    const votes: Vote[] = [
      { id: 'u1', userId: 'u1', selectedOptionIds: ['opt-1'], votedAt: new Date().toISOString() },
      { id: 'u2', userId: 'u2', selectedOptionIds: ['opt-1'], votedAt: new Date().toISOString() },
      { id: 'u3', userId: 'u3', selectedOptionIds: ['opt-2'], votedAt: new Date().toISOString() },
    ];

    const summary = calculateRoundResults(dummyRound, votes);
    expect(summary.totalVoters).toBe(3);
    expect(summary.hasTieForFirst).toBe(false);
    expect(summary.winner?.option.id).toBe('opt-1');
    expect(summary.winner?.votesCount).toBe(2);
    expect(summary.results[0].rank).toBe(1);
    expect(summary.results[1].rank).toBe(2);
    expect(summary.results[2].rank).toBe(3);
  });

  it('should detect a tie for 1st place when top options have equal votes', () => {
    const votes: Vote[] = [
      { id: 'u1', userId: 'u1', selectedOptionIds: ['opt-1'], votedAt: new Date().toISOString() },
      { id: 'u2', userId: 'u2', selectedOptionIds: ['opt-2'], votedAt: new Date().toISOString() },
      { id: 'u3', userId: 'u3', selectedOptionIds: ['opt-3'], votedAt: new Date().toISOString() },
    ];

    const summary = calculateRoundResults(dummyRound, votes);
    expect(summary.totalVoters).toBe(3);
    expect(summary.hasTieForFirst).toBe(true);
    expect(summary.winner).toBeNull();
    expect(summary.tiedFirstOptions.length).toBe(3);
  });

  it('should correctly filter candidates for tie_breaker runoff round', () => {
    const votes: Vote[] = [
      { id: 'u1', userId: 'u1', selectedOptionIds: ['opt-1'], votedAt: new Date().toISOString() },
      { id: 'u2', userId: 'u2', selectedOptionIds: ['opt-1'], votedAt: new Date().toISOString() },
      { id: 'u3', userId: 'u3', selectedOptionIds: ['opt-2'], votedAt: new Date().toISOString() },
      { id: 'u4', userId: 'u4', selectedOptionIds: ['opt-2'], votedAt: new Date().toISOString() },
      { id: 'u5', userId: 'u5', selectedOptionIds: ['opt-3'], votedAt: new Date().toISOString() },
    ];

    const summary = calculateRoundResults(dummyRound, votes);
    expect(summary.hasTieForFirst).toBe(true);
    expect(summary.tiedFirstOptions.length).toBe(2);

    const runoffCandidates = filterCandidatesForRunoff(summary, 'tie_breaker');
    expect(runoffCandidates.length).toBe(2);
    expect(runoffCandidates.map(c => c.id).sort()).toEqual(['opt-1', 'opt-2']);
  });

  it('should filter candidates for top_k runoff', () => {
    const votes: Vote[] = [
      { id: 'u1', userId: 'u1', selectedOptionIds: ['opt-1'], votedAt: new Date().toISOString() },
      { id: 'u2', userId: 'u2', selectedOptionIds: ['opt-2'], votedAt: new Date().toISOString() },
    ];

    const summary = calculateRoundResults(dummyRound, votes);
    const top2 = filterCandidatesForRunoff(summary, 'top_k', 2);
    expect(top2.length).toBe(2);
  });
});
