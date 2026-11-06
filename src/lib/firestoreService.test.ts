import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createPoll,
  getPoll,
  getPublicPolls,
  getUserCreatedPolls,
  getAccessedPollIds,
  recordAccessedPoll,
  removeAccessedPoll,
  deletePoll,
  castVote,
  verifyVoteEditKey,
  deleteVote,
  adminUpdateVote,
  setPollDecision,
  updatePollEventInfo,
  LegacyVoteError,
  addScheduleOptions,
} from './firestoreService';
import { computeProof, InvalidEditKeyError } from './editKey';
import { ScheduleCapacityError } from './scheduleUtils';
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
  it('allows creator to delete poll and removes it from all lists', async () => {
    const pollId = await createPoll(
      {
        title: 'Poll to Delete',
        description: 'Will be deleted',
        creatorUid: 'user_admin',
        creatorDisplayName: 'Admin User',
        status: 'active',
        isPublicResult: true,
        requireAuth: true,
        showVoterNames: false,
      },
      sampleRound
    );

    // Verify it exists initially
    expect(await getPoll(pollId)).not.toBeNull();
    expect((await getUserCreatedPolls('user_admin')).length).toBe(1);
    expect(getAccessedPollIds()).toContain(pollId);

    // Creator deletes poll
    await deletePoll(pollId, 'user_admin');

    // Verify it is gone
    expect(await getPoll(pollId)).toBeNull();
    expect((await getUserCreatedPolls('user_admin')).length).toBe(0);
    expect(getAccessedPollIds()).not.toContain(pollId);
    expect(await getPublicPolls()).toEqual([]);
  });

  it('rejects deletion when user is not the creator', async () => {
    const pollId = await createPoll(
      {
        title: 'Protected Poll',
        description: 'Cannot be deleted by others',
        creatorUid: 'user_owner',
        creatorDisplayName: 'Owner',
        status: 'active',
        isPublicResult: true,
        requireAuth: true,
        showVoterNames: false,
      },
      sampleRound
    );

    await expect(deletePoll(pollId, 'user_impostor')).rejects.toThrow('権限がありません');

    // Poll should still exist
    expect(await getPoll(pollId)).not.toBeNull();
  });

  describe('anonymous edit key (mock mode)', () => {
    const anonVote = (name: string) => ({
      userId: 'anon_x',
      userDisplayName: name,
      selectedOptionIds: ['opt_1'],
      scheduleResponses: { opt_1: 'circle' as const },
      isAnonymous: true,
    });

    it('allows edits/deletes only with the matching password', async () => {
      const pollId = await createPoll(
        {
          title: 'Sched',
          description: '',
          creatorUid: 'admin',
          creatorDisplayName: 'Admin',
          status: 'active',
          isPublicResult: true,
          requireAuth: false,
          showVoterNames: true,
          pollType: 'schedule',
        },
        sampleRound
      );
      const good = await computeProof(pollId, 'anon_x', 'pass1234');
      const bad = await computeProof(pollId, 'anon_x', 'wrong');

      await castVote(pollId, 1, anonVote('Taro'), { proof: good });

      await expect(castVote(pollId, 1, anonVote('Hacked'), { proof: bad })).rejects.toBeInstanceOf(
        InvalidEditKeyError
      );
      await expect(verifyVoteEditKey(pollId, 1, 'anon_x', bad)).rejects.toBeInstanceOf(InvalidEditKeyError);
      await expect(verifyVoteEditKey(pollId, 1, 'anon_x', good)).resolves.toBeUndefined();

      await castVote(pollId, 1, anonVote('Taro2'), { proof: good });

      // Password change
      const next = await computeProof(pollId, 'anon_x', 'newpass');
      await castVote(pollId, 1, anonVote('Taro3'), { proof: good, newProof: next });
      await expect(verifyVoteEditKey(pollId, 1, 'anon_x', good)).rejects.toBeInstanceOf(InvalidEditKeyError);

      await expect(deleteVote(pollId, 1, 'anon_x', { proof: good, isAnonymous: true })).rejects.toBeInstanceOf(
        InvalidEditKeyError
      );
      await deleteVote(pollId, 1, 'anon_x', { proof: next, isAnonymous: true });
      const votes = JSON.parse(mockStore['votica_mock_votes'] || '{}');
      expect(votes[pollId][1]['anon_x']).toBeUndefined();
    });

    it('rejects anonymous votes without credentials and legacy votes', async () => {
      const pollId = await createPoll(
        {
          title: 'Sched',
          description: '',
          creatorUid: 'admin',
          creatorDisplayName: 'Admin',
          status: 'active',
          isPublicResult: true,
          requireAuth: false,
          showVoterNames: true,
          pollType: 'schedule',
        },
        sampleRound
      );
      await expect(castVote(pollId, 1, anonVote('NoKey'))).rejects.toBeInstanceOf(InvalidEditKeyError);

      // Legacy anonymous vote (no isAnonymous flag / no secret)
      await castVote(pollId, 1, { userId: 'anon_x', userDisplayName: 'Old', selectedOptionIds: [] });
      const proof = await computeProof(pollId, 'anon_x', 'x');
      await expect(castVote(pollId, 1, anonVote('New'), { proof })).rejects.toBeInstanceOf(LegacyVoteError);

      // Admin can still edit it
      await adminUpdateVote(pollId, 1, 'anon_x', {
        userDisplayName: 'Fixed',
        selectedOptionIds: [],
        scheduleResponses: { opt_1: 'cross' },
        comment: '',
      });
      const votes = JSON.parse(mockStore['votica_mock_votes'] || '{}');
      expect(votes[pollId][1]['anon_x'].userDisplayName).toBe('Fixed');
      expect(votes[pollId][1]['anon_x'].editedByAdmin).toBe(true);
    });
  });

  it('stores decision and normalized event info', async () => {
    const pollId = await createPoll(
      {
        title: 'Sched',
        description: '',
        creatorUid: 'admin',
        creatorDisplayName: 'Admin',
        status: 'active',
        isPublicResult: true,
        requireAuth: false,
        showVoterNames: true,
        pollType: 'schedule',
      },
      sampleRound
    );
    await setPollDecision(pollId, {
      optionId: 'opt_1',
      label: 'A',
      date: '2026-08-25',
      allDay: true,
      decidedAt: new Date().toISOString(),
    });
    await updatePollEventInfo(pollId, { location: '  Shibuya ', locationUrl: 'javascript:alert(1)', fee: '¥4000' });
    const poll = await getPoll(pollId);
    expect(poll?.decision?.date).toBe('2026-08-25');
    expect(poll?.location).toBe('Shibuya');
    expect(poll?.locationUrl).toBe('');
    expect(poll?.fee).toBe('¥4000');

    await setPollDecision(pollId, null);
    expect((await getPoll(pollId))?.decision).toBeNull();
  });

  it('adds schedule candidates (mock mode)', async () => {
    const pollId = await createPoll(
      {
        title: 'Sched', description: '', creatorUid: 'admin', creatorDisplayName: 'Admin',
        status: 'active', isPublicResult: true, requireAuth: false, showVoterNames: true, pollType: 'schedule',
      },
      { ...sampleRound, options: [{ id: 'opt_sched_1_a', text: '12/10 19:00〜' }], maxChoices: 1 }
    );
    const res = await addScheduleOptions(pollId, 1, ['12/5 19:00〜', '12/10 19:00〜', '12/12 終日']);
    expect(res).toEqual({ addedCount: 2, skippedCount: 1 });
    const rounds = JSON.parse(mockStore['votica_mock_rounds']);
    const round = rounds[pollId][1];
    expect(round.options.map((o: any) => o.text)).toEqual(['12/5 19:00〜', '12/10 19:00〜', '12/12 終日']);
    expect(round.maxChoices).toBe(3);
  });

  it('enforces participant capacity on schedule votes (mock mode)', async () => {
    const pollId = await createPoll(
      {
        title: 'Cap', description: '', creatorUid: 'admin', creatorDisplayName: 'Admin',
        status: 'active', isPublicResult: true, requireAuth: true, showVoterNames: true, pollType: 'schedule',
        capacity: 2,
      },
      { ...sampleRound, maxChoices: 2 }
    );
    const vote = (userId: string, a: 'circle' | 'triangle' | 'cross', b: 'circle' | 'triangle' | 'cross' = 'cross') => ({
      userId, userDisplayName: userId, selectedOptionIds: [], scheduleResponses: { opt_1: a, opt_2: b },
    });
    const cap = { capacity: 2 };
    await castVote(pollId, 1, vote('u1', 'circle'), undefined, cap);
    await castVote(pollId, 1, vote('u2', 'circle'), undefined, cap);

    await expect(castVote(pollId, 1, vote('u3', 'circle'), undefined, cap)).rejects.toBeInstanceOf(ScheduleCapacityError);
    await castVote(pollId, 1, vote('u3', 'triangle', 'circle'), undefined, cap); // other candidate OK
    await castVote(pollId, 1, vote('u1', 'circle', 'circle'), undefined, cap); // keeps own ◯
    await castVote(pollId, 1, vote('u4', 'circle'), undefined, { capacity: null }); // unlimited

    // Admin edits are not restricted
    await adminUpdateVote(pollId, 1, 'u3', {
      userDisplayName: 'u3', selectedOptionIds: ['opt_1'], scheduleResponses: { opt_1: 'circle', opt_2: 'circle' }, comment: '',
    });
    const votes = JSON.parse(mockStore['votica_mock_votes'])[pollId][1];
    expect(votes.u3.scheduleResponses.opt_1).toBe('circle');
  });
});
