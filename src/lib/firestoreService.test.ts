import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createPoll,
  getPoll,
  getPublicPolls,
  getUserCreatedPolls,
  getAccessedPollIds,
  recordAccessedPoll,
  removeAccessedPoll,
} from './firestoreService';
import { PollOption, PollRound } from './types';

describe('firestoreService - Poll Discovery and URL-based Access', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    const mockLocalStorage = {
      getItem: (key: string) => mockStore[key] || null,
      setItem: (key: string, value: string) => {
        mockStore[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
    vi.stubGlobal('dispatchEvent', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleOptions: PollOption[] = [
    { id: 'opt_1', text: 'Option A' },
    { id: 'opt_2', text: 'Option B' },
  ];

  const sampleRound: Omit<PollRound, 'roundNumber'> = {
    title: 'Round 1',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 86400000).toISOString(),
    maxChoices: 1,
    options: sampleOptions,
    status: 'open',
  };

  it('records and retrieves accessed poll IDs correctly', () => {
    expect(getAccessedPollIds()).toEqual([]);

    recordAccessedPoll('poll_1');
    expect(getAccessedPollIds()).toEqual(['poll_1']);

    recordAccessedPoll('poll_2');
    expect(getAccessedPollIds()).toEqual(['poll_2', 'poll_1']);

    // Re-accessing moves poll to front without duplicates
    recordAccessedPoll('poll_1');
    expect(getAccessedPollIds()).toEqual(['poll_1', 'poll_2']);

    removeAccessedPoll('poll_2');
    expect(getAccessedPollIds()).toEqual(['poll_1']);
  });

  it('returns empty array in getPublicPolls for a user who does not know any poll URL', async () => {
    // User A creates a poll
    await createPoll(
      {
        title: 'Secret Team Poll',
        description: 'Only for invited members',
        creatorUid: 'user_a',
        creatorDisplayName: 'User A',
        status: 'active',
        isPublicResult: true,
        requireAuth: true,
        showVoterNames: false,
      },
      sampleRound
    );

    // Simulate User B (stranger) accessing top page with empty localStorage for accessed polls
    mockStore['votica_accessed_poll_ids'] = JSON.stringify([]);

    const publicPolls = await getPublicPolls();
    expect(publicPolls).toEqual([]);
  });

  it('returns only accessed polls when user knows the URL / has accessed the poll', async () => {
    // User A creates Poll 1
    await createPoll(
      {
        title: 'Poll 1',
        description: 'First poll',
        creatorUid: 'user_a',
        creatorDisplayName: 'User A',
        status: 'active',
        isPublicResult: true,
        requireAuth: true,
        showVoterNames: false,
      },
      sampleRound
    );

    // User A creates Poll 2
    const poll2Id = await createPoll(
      {
        title: 'Poll 2',
        description: 'Second poll',
        creatorUid: 'user_a',
        creatorDisplayName: 'User A',
        status: 'active',
        isPublicResult: false,
        requireAuth: true,
        showVoterNames: false,
      },
      sampleRound
    );

    // Stranger only receives the URL for Poll 2
    mockStore['votica_accessed_poll_ids'] = JSON.stringify([poll2Id]);

    const publicPolls = await getPublicPolls();
    expect(publicPolls.length).toBe(1);
    expect(publicPolls[0].id).toBe(poll2Id);
    expect(publicPolls[0].title).toBe('Poll 2');
  });

  it('creator still sees their created polls via getUserCreatedPolls', async () => {
    const pollId = await createPoll(
      {
        title: 'Creator Poll',
        description: 'Poll by User A',
        creatorUid: 'user_a',
        creatorDisplayName: 'User A',
        status: 'active',
        isPublicResult: true,
        requireAuth: true,
        showVoterNames: false,
      },
      sampleRound
    );

    const userAPolls = await getUserCreatedPolls('user_a');
    expect(userAPolls.length).toBe(1);
    expect(userAPolls[0].id).toBe(pollId);

    const userBPolls = await getUserCreatedPolls('user_b');
    expect(userBPolls.length).toBe(0);
  });

  it('retrieves individual poll by ID with getPoll', async () => {
    const pollId = await createPoll(
      {
        title: 'Individual Poll',
        description: 'Desc',
        creatorUid: 'user_x',
        creatorDisplayName: 'User X',
        status: 'active',
        isPublicResult: false,
        requireAuth: true,
        showVoterNames: false,
      },
      sampleRound
    );

    const poll = await getPoll(pollId);
    expect(poll).not.toBeNull();
    expect(poll?.title).toBe('Individual Poll');

    const nonExistent = await getPoll('poll_does_not_exist');
    expect(nonExistent).toBeNull();
  });
});
