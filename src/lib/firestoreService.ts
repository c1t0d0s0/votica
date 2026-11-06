import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { Poll, PollEventInfo, PollRound, ScheduleDecision, Vote } from './types';
import { computeSecretHash, InvalidEditKeyError } from './editKey';
import {
  sanitizeHttpUrl,
  mergeScheduleCandidates,
  normalizeCapacity,
  findCapacityViolations,
  ScheduleCapacityError,
} from './scheduleUtils';

// Mock storage keys for offline/demo mode
const MOCK_POLLS_KEY = 'votica_mock_polls';
const MOCK_ROUNDS_KEY = 'votica_mock_rounds';
const MOCK_VOTES_KEY = 'votica_mock_votes';
const ACCESSED_POLLS_KEY = 'votica_accessed_poll_ids';
const MOCK_VOTE_SECRETS_KEY = 'votica_mock_vote_secrets';

/** Thrown when an anonymous vote saved by the legacy scheme (no edit key) is edited by a non-admin. */
export class LegacyVoteError extends Error {
  constructor(message = 'LEGACY_VOTE') {
    super(message);
    this.name = 'LegacyVoteError';
  }
}

function isPermissionDenied(err: any): boolean {
  return err?.code === 'permission-denied' || /permission/i.test(String(err?.message || ''));
}

/**
 * Retrieves the list of poll IDs that have been accessed / visited by this client.
 */
export function getAccessedPollIds(): string[] {
  try {
    const raw = localStorage.getItem(ACCESSED_POLLS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Records a poll ID as accessed / known by this client.
 */
export function recordAccessedPoll(pollId: string): void {
  if (!pollId || typeof pollId !== 'string') return;
  try {
    const current = getAccessedPollIds();
    const filtered = current.filter(id => id !== pollId);
    const updated = [pollId, ...filtered].slice(0, 50);
    localStorage.setItem(ACCESSED_POLLS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to record accessed poll:', e);
  }
}

/**
 * Removes a poll ID from the accessed history.
 */
export function removeAccessedPoll(pollId: string): void {
  try {
    const current = getAccessedPollIds();
    const updated = current.filter(id => id !== pollId);
    localStorage.setItem(ACCESSED_POLLS_KEY, JSON.stringify(updated));
  } catch {}
}

// Helper for converting Firestore timestamp or ISO string to ISO string
function toIsoDate(val: any): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return new Date(val).toISOString();
  return new Date().toISOString();
}

// Helper to recursively strip undefined fields so Firestore setDoc / updateDoc never fails
function cleanFirestoreData<T extends Record<string, any>>(obj: T): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(item =>
      item && typeof item === 'object' && !(item instanceof Date)
        ? cleanFirestoreData(item)
        : item
    );
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] =
          value && typeof value === 'object' && !(value instanceof Date)
            ? cleanFirestoreData(value)
            : value;
      }
    }
    return cleaned;
  }
  return obj;
}

/* =========================================================================
   MOCK / LOCAL STORAGE SERVICE HELPERS (Works without Firebase configuration)
   ========================================================================= */

function getMockPolls(): Record<string, Poll> {
  try {
    return JSON.parse(localStorage.getItem(MOCK_POLLS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveMockPolls(polls: Record<string, Poll>) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(MOCK_POLLS_KEY, JSON.stringify(polls));
  }
  if (typeof window !== 'undefined' && typeof Event !== 'undefined') {
    window.dispatchEvent(new Event('votica_mock_update'));
  }
}

function getMockRounds(): Record<string, Record<number, PollRound>> {
  try {
    return JSON.parse(localStorage.getItem(MOCK_ROUNDS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveMockRounds(rounds: Record<string, Record<number, PollRound>>) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(MOCK_ROUNDS_KEY, JSON.stringify(rounds));
  }
  if (typeof window !== 'undefined' && typeof Event !== 'undefined') {
    window.dispatchEvent(new Event('votica_mock_update'));
  }
}

function getMockVotes(): Record<string, Record<number, Record<string, Vote>>> {
  try {
    return JSON.parse(localStorage.getItem(MOCK_VOTES_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveMockVotes(votes: Record<string, Record<number, Record<string, Vote>>>) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(MOCK_VOTES_KEY, JSON.stringify(votes));
  }
  if (typeof window !== 'undefined' && typeof Event !== 'undefined') {
    window.dispatchEvent(new Event('votica_mock_update'));
  }
}

function getMockVoteSecrets(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MOCK_VOTE_SECRETS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveMockVoteSecrets(secrets: Record<string, string>) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(MOCK_VOTE_SECRETS_KEY, JSON.stringify(secrets));
  }
}

function mockSecretKey(pollId: string, roundNumber: number, voteId: string): string {
  return `${pollId}/${roundNumber}/${voteId}`;
}

async function assertMockProof(pollId: string, roundNumber: number, voteId: string, proof: string) {
  const stored = getMockVoteSecrets()[mockSecretKey(pollId, roundNumber, voteId)];
  if (!stored || stored !== (await computeSecretHash(proof))) {
    throw new InvalidEditKeyError();
  }
}

/* =========================================================================
   FIRESTORE / PRODUCTION SERVICE FUNCTIONS
   ========================================================================= */

/**
 * Creates a new poll with an initial round (Round 1).
 */
export async function createPoll(
  pollData: Omit<Poll, 'id' | 'createdAt' | 'updatedAt' | 'currentRound' | 'totalRounds'>,
  initialRound: Omit<PollRound, 'roundNumber'>
): Promise<string> {
  const pollId = 'poll_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
  const nowIso = new Date().toISOString();

  const newPoll: Poll = {
    ...pollData,
    id: pollId,
    currentRound: 1,
    totalRounds: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const newRound1: PollRound = {
    ...initialRound,
    roundNumber: 1,
    createdAt: nowIso,
  };

  if (!isFirebaseConfigured || !db) {
    // Save to mock storage
    const polls = getMockPolls();
    polls[pollId] = newPoll;
    saveMockPolls(polls);

    const rounds = getMockRounds();
    rounds[pollId] = { 1: newRound1 };
    saveMockRounds(rounds);

    recordAccessedPoll(pollId);
    return pollId;
  }

  // Firestore transaction / batch writes
  const pollDocRef = doc(db, 'polls', pollId);
  const round1DocRef = doc(db, 'polls', pollId, 'rounds', '1');

  await setDoc(pollDocRef, {
    ...cleanFirestoreData(newPoll),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(round1DocRef, {
    ...cleanFirestoreData(newRound1),
    createdAt: serverTimestamp(),
  });

  recordAccessedPoll(pollId);
  return pollId;
}

/**
 * Subscribes to real-time updates for a single poll.
 */
export function subscribePoll(pollId: string, callback: (poll: Poll | null) => void): () => void {
  if (!isFirebaseConfigured || !db) {
    const check = () => {
      const polls = getMockPolls();
      const poll = polls[pollId] || null;
      if (poll) {
        recordAccessedPoll(pollId);
      }
      callback(poll);
    };
    check();
    window.addEventListener('votica_mock_update', check);
    return () => window.removeEventListener('votica_mock_update', check);
  }

  const pollDocRef = doc(db, 'polls', pollId);
  return onSnapshot(
    pollDocRef,
    docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        recordAccessedPoll(docSnap.id);
        callback({
          ...(data as Poll),
          requireAuth: data.requireAuth !== false,
          showVoterNames: data.showVoterNames === true,
          id: docSnap.id,
          createdAt: toIsoDate(data.createdAt),
          updatedAt: toIsoDate(data.updatedAt),
        });
      } else {
        callback(null);
      }
    },
    err => {
      console.error('Error fetching poll:', err);
      callback(null);
    }
  );
}

/**
 * Subscribes to real-time updates for a specific round of a poll.
 */
export function subscribeRound(
  pollId: string,
  roundNumber: number,
  callback: (round: PollRound | null) => void
): () => void {
  if (!isFirebaseConfigured || !db) {
    const check = () => {
      const rounds = getMockRounds();
      callback(rounds[pollId]?.[roundNumber] || null);
    };
    check();
    window.addEventListener('votica_mock_update', check);
    return () => window.removeEventListener('votica_mock_update', check);
  }

  const roundDocRef = doc(db, 'polls', pollId, 'rounds', roundNumber.toString());
  return onSnapshot(
    roundDocRef,
    docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback({
          ...(data as PollRound),
          roundNumber,
          startDate: toIsoDate(data.startDate),
          endDate: toIsoDate(data.endDate),
          createdAt: toIsoDate(data.createdAt),
        });
      } else {
        callback(null);
      }
    },
    err => {
      console.error('Error fetching round:', err);
      callback(null);
    }
  );
}

/**
 * Subscribes to all rounds for a poll.
 */
export function subscribeAllRounds(
  pollId: string,
  callback: (rounds: PollRound[]) => void
): () => void {
  if (!isFirebaseConfigured || !db) {
    const check = () => {
      const roundsMap = getMockRounds()[pollId] || {};
      const list = Object.values(roundsMap).sort((a, b) => a.roundNumber - b.roundNumber);
      callback(list);
    };
    check();
    window.addEventListener('votica_mock_update', check);
    return () => window.removeEventListener('votica_mock_update', check);
  }

  const roundsColRef = collection(db, 'polls', pollId, 'rounds');
  return onSnapshot(
    roundsColRef,
    snapshot => {
      const list: PollRound[] = snapshot.docs.map(d => {
        const data = d.data();
        return {
          ...(data as PollRound),
          roundNumber: parseInt(d.id, 10) || data.roundNumber,
          startDate: toIsoDate(data.startDate),
          endDate: toIsoDate(data.endDate),
          createdAt: toIsoDate(data.createdAt),
        };
      });
      list.sort((a, b) => a.roundNumber - b.roundNumber);
      callback(list);
    },
    err => {
      console.error('Error fetching rounds:', err);
      callback([]);
    }
  );
}

/**
 * Edit-key credentials for anonymous (no-login) votes.
 * - proof: proof for the current password (or the device key)
 * - newProof: optional, sets a new password (on create: used instead of `proof`)
 */
export interface VoteEditAuth {
  proof: string;
  newProof?: string;
}

function assertRoundOpen(round: { status?: string; endDate?: any } | undefined | null, nowMs: number) {
  if (!round) return;
  const endMs = new Date(toIsoDate(round.endDate)).getTime();
  if (round.status === 'closed' || nowMs > endMs) {
    throw new Error('この投票ラウンドの受付期間は終了しています');
  }
}

/**
 * Casts or updates a vote for the specified user and round.
 * 1 vote per user is enforced by writing to doc `rounds/{roundNumber}/votes/{userId}`.
 *
 * Anonymous votes (`vote.isAnonymous === true`) must pass `editAuth`:
 * on create the secret hash is stored in `voteSecrets/{userId}`, on update the proof is
 * written to `voteProofs/{userId}` in the same batch and verified by the security rules.
 */
export async function castVote(
  pollId: string,
  roundNumber: number,
  vote: Omit<Vote, 'id' | 'votedAt'>,
  editAuth?: VoteEditAuth,
  options: { capacity?: number | null } = {}
): Promise<void> {
  const capacity = normalizeCapacity(options.capacity);
  const nowMs = Date.now();
  const nowIso = new Date().toISOString();
  const voteDocData: Vote = {
    ...vote,
    id: vote.userId,
    votedAt: nowIso,
  };

  if (vote.isAnonymous && !editAuth) {
    throw new InvalidEditKeyError();
  }

  if (!isFirebaseConfigured || !db) {
    const rounds = getMockRounds();
    assertRoundOpen(rounds[pollId]?.[roundNumber], nowMs);

    const mockRound = rounds[pollId]?.[roundNumber];
    if (capacity && mockRound && vote.scheduleResponses) {
      const others = Object.values(getMockVotes()[pollId]?.[roundNumber] || {});
      const violations = findCapacityViolations(mockRound, others, capacity, vote.userId, vote.scheduleResponses);
      if (violations.length > 0) throw new ScheduleCapacityError(violations);
    }

    const allVotes = getMockVotes();
    if (!allVotes[pollId]) allVotes[pollId] = {};
    if (!allVotes[pollId][roundNumber]) allVotes[pollId][roundNumber] = {};
    const existing = allVotes[pollId][roundNumber][vote.userId];

    if (vote.isAnonymous && editAuth) {
      const secrets = getMockVoteSecrets();
      const key = mockSecretKey(pollId, roundNumber, vote.userId);
      if (!existing) {
        secrets[key] = await computeSecretHash(editAuth.newProof || editAuth.proof);
      } else {
        if (!existing.isAnonymous) throw new LegacyVoteError();
        await assertMockProof(pollId, roundNumber, vote.userId, editAuth.proof);
        if (editAuth.newProof) secrets[key] = await computeSecretHash(editAuth.newProof);
      }
      saveMockVoteSecrets(secrets);
    }

    allVotes[pollId][roundNumber][vote.userId] = voteDocData;
    saveMockVotes(allVotes);
    recordAccessedPoll(pollId);
    return;
  }

  const roundId = roundNumber.toString();
  const roundDocRef = doc(db, 'polls', pollId, 'rounds', roundId);
  const roundSnap = await getDoc(roundDocRef);
  if (roundSnap.exists()) {
    assertRoundOpen(roundSnap.data(), nowMs);

    // Participant capacity (client-side check: rules cannot aggregate votes)
    if (capacity && vote.scheduleResponses) {
      const votesSnap = await getDocs(collection(db, 'polls', pollId, 'rounds', roundId, 'votes'));
      const allVotes = votesSnap.docs.map(d => ({ ...(d.data() as Vote), id: d.id }));
      const roundData = roundSnap.data() as PollRound;
      const violations = findCapacityViolations(
        { options: roundData.options || [] },
        allVotes,
        capacity,
        vote.userId,
        vote.scheduleResponses
      );
      if (violations.length > 0) throw new ScheduleCapacityError(violations);
    }
  }

  const voteDocRef = doc(db, 'polls', pollId, 'rounds', roundId, 'votes', vote.userId);
  const firestoreVote = {
    ...cleanFirestoreData(voteDocData),
    votedAt: serverTimestamp(),
  };

  if (!vote.isAnonymous || !editAuth) {
    await setDoc(voteDocRef, firestoreVote);
    recordAccessedPoll(pollId);
    return;
  }

  const existingSnap = await getDoc(voteDocRef);
  const secretRef = doc(db, 'polls', pollId, 'rounds', roundId, 'voteSecrets', vote.userId);
  const proofRef = doc(db, 'polls', pollId, 'rounds', roundId, 'voteProofs', vote.userId);
  const batch = writeBatch(db);

  if (!existingSnap.exists()) {
    batch.set(voteDocRef, firestoreVote);
    batch.set(secretRef, { hash: await computeSecretHash(editAuth.newProof || editAuth.proof) });
  } else {
    if (existingSnap.data().isAnonymous !== true) throw new LegacyVoteError();
    batch.set(proofRef, { proof: editAuth.proof });
    batch.set(voteDocRef, firestoreVote);
    if (editAuth.newProof) {
      batch.set(secretRef, { hash: await computeSecretHash(editAuth.newProof) });
    }
  }

  try {
    await batch.commit();
  } catch (err) {
    if (isPermissionDenied(err)) throw new InvalidEditKeyError();
    throw err;
  }
  recordAccessedPoll(pollId);
}

/**
 * Verifies an edit key for an anonymous vote without changing the vote.
 * Firestore: re-writes the same secret hash together with the proof; the rules reject it when the key is wrong.
 * Throws InvalidEditKeyError when the key does not match, LegacyVoteError if the vote has no edit key.
 */
export async function verifyVoteEditKey(
  pollId: string,
  roundNumber: number,
  voteId: string,
  proof: string
): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    const existing = getMockVotes()[pollId]?.[roundNumber]?.[voteId];
    if (existing && !existing.isAnonymous) throw new LegacyVoteError();
    await assertMockProof(pollId, roundNumber, voteId, proof);
    return;
  }

  const roundId = roundNumber.toString();
  const voteSnap = await getDoc(doc(db, 'polls', pollId, 'rounds', roundId, 'votes', voteId));
  if (voteSnap.exists() && voteSnap.data().isAnonymous !== true) throw new LegacyVoteError();

  const batch = writeBatch(db);
  batch.set(doc(db, 'polls', pollId, 'rounds', roundId, 'voteProofs', voteId), { proof });
  batch.set(doc(db, 'polls', pollId, 'rounds', roundId, 'voteSecrets', voteId), {
    hash: await computeSecretHash(proof),
  });
  try {
    await batch.commit();
  } catch (err) {
    if (isPermissionDenied(err)) throw new InvalidEditKeyError();
    throw err;
  }
}

/**
 * Deletes a vote.
 * - Admin (poll creator) / Google user deleting own vote: no proof needed.
 * - Anonymous voter: pass the proof of the edit key.
 * `isAnonymous` indicates the vote has an edit-key secret that must be removed too.
 */
export async function deleteVote(
  pollId: string,
  roundNumber: number,
  voteId: string,
  options: { proof?: string; isAnonymous?: boolean } = {}
): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    if (options.proof) {
      await assertMockProof(pollId, roundNumber, voteId, options.proof);
    }
    const allVotes = getMockVotes();
    if (allVotes[pollId]?.[roundNumber]?.[voteId]) {
      delete allVotes[pollId][roundNumber][voteId];
      saveMockVotes(allVotes);
    }
    const secrets = getMockVoteSecrets();
    delete secrets[mockSecretKey(pollId, roundNumber, voteId)];
    saveMockVoteSecrets(secrets);
    return;
  }

  const roundId = roundNumber.toString();
  const batch = writeBatch(db);
  if (options.proof) {
    batch.set(doc(db, 'polls', pollId, 'rounds', roundId, 'voteProofs', voteId), { proof: options.proof });
  }
  batch.delete(doc(db, 'polls', pollId, 'rounds', roundId, 'votes', voteId));
  if (options.isAnonymous || options.proof) {
    batch.delete(doc(db, 'polls', pollId, 'rounds', roundId, 'voteSecrets', voteId));
  }
  try {
    await batch.commit();
  } catch (err) {
    if (options.proof && isPermissionDenied(err)) throw new InvalidEditKeyError();
    throw err;
  }
}

/**
 * Admin (poll creator) edits another participant's vote. Keeps userId / votedAt.
 * Allowed even after the round is closed.
 */
export async function adminUpdateVote(
  pollId: string,
  roundNumber: number,
  voteId: string,
  patch: Pick<Vote, 'userDisplayName' | 'selectedOptionIds' | 'scheduleResponses' | 'comment'>
): Promise<void> {
  const cleanedPatch = {
    userDisplayName: patch.userDisplayName,
    selectedOptionIds: patch.selectedOptionIds,
    scheduleResponses: patch.scheduleResponses,
    comment: patch.comment || '',
    editedByAdmin: true,
  };

  if (!isFirebaseConfigured || !db) {
    const allVotes = getMockVotes();
    const existing = allVotes[pollId]?.[roundNumber]?.[voteId];
    if (!existing) throw new Error('回答が見つかりません');
    allVotes[pollId][roundNumber][voteId] = { ...existing, ...cleanedPatch };
    saveMockVotes(allVotes);
    return;
  }

  const voteDocRef = doc(db, 'polls', pollId, 'rounds', roundNumber.toString(), 'votes', voteId);
  await updateDoc(voteDocRef, cleanFirestoreData(cleanedPatch));
}

/**
 * Subscribes to the current user's vote in a specific round.
 */
export function subscribeUserVote(
  pollId: string,
  roundNumber: number,
  userId: string | undefined,
  callback: (vote: Vote | null) => void
): () => void {
  if (!userId) {
    callback(null);
    return () => {};
  }

  if (!isFirebaseConfigured || !db) {
    const check = () => {
      const allVotes = getMockVotes();
      const userVote = allVotes[pollId]?.[roundNumber]?.[userId] || null;
      callback(userVote);
    };
    check();
    window.addEventListener('votica_mock_update', check);
    return () => window.removeEventListener('votica_mock_update', check);
  }

  const voteDocRef = doc(db, 'polls', pollId, 'rounds', roundNumber.toString(), 'votes', userId);
  return onSnapshot(
    voteDocRef,
    docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback({
          ...(data as Vote),
          id: docSnap.id,
          votedAt: toIsoDate(data.votedAt),
        });
      } else {
        callback(null);
      }
    },
    err => {
      console.error('Error fetching user vote:', err);
      callback(null);
    }
  );
}

/**
 * Subscribes to all votes in a round for live tallying.
 */
export function subscribeRoundVotes(
  pollId: string,
  roundNumber: number,
  callback: (votes: Vote[]) => void
): () => void {
  if (!isFirebaseConfigured || !db) {
    const check = () => {
      const allVotes = getMockVotes();
      const roundVotesMap = allVotes[pollId]?.[roundNumber] || {};
      callback(Object.values(roundVotesMap));
    };
    check();
    window.addEventListener('votica_mock_update', check);
    return () => window.removeEventListener('votica_mock_update', check);
  }

  const votesColRef = collection(db, 'polls', pollId, 'rounds', roundNumber.toString(), 'votes');
  return onSnapshot(
    votesColRef,
    snapshot => {
      const votesList: Vote[] = snapshot.docs.map(d => {
        const data = d.data();
        return {
          ...(data as Vote),
          id: d.id,
          votedAt: toIsoDate(data.votedAt),
        };
      });
      callback(votesList);
    },
    err => {
      console.error('Error fetching round votes:', err);
      callback([]);
    }
  );
}

/**
 * Creates a Runoff Round (Round 2, 3, etc.) and updates poll.currentRound & totalRounds.
 * Automatically closes previous round.
 */
export async function createRunoffRound(
  pollId: string,
  newRoundData: Omit<PollRound, 'roundNumber'>,
  nextRoundNumber: number
): Promise<number> {
  const nowIso = new Date().toISOString();
  const nextRound: PollRound = {
    ...newRoundData,
    roundNumber: nextRoundNumber,
    status: 'open',
    createdAt: nowIso,
  };

  const prevRoundNumber = nextRoundNumber - 1;

  if (!isFirebaseConfigured || !db) {
    const polls = getMockPolls();
    if (polls[pollId]) {
      polls[pollId].currentRound = nextRoundNumber;
      polls[pollId].totalRounds = Math.max(polls[pollId].totalRounds, nextRoundNumber);
      polls[pollId].updatedAt = nowIso;
      saveMockPolls(polls);
    }

    const rounds = getMockRounds();
    if (!rounds[pollId]) rounds[pollId] = {};
    if (prevRoundNumber >= 1 && rounds[pollId][prevRoundNumber]) {
      rounds[pollId][prevRoundNumber].status = 'closed';
    }
    rounds[pollId][nextRoundNumber] = nextRound;
    saveMockRounds(rounds);

    return nextRoundNumber;
  }

  // Close previous round in Firestore
  if (prevRoundNumber >= 1) {
    try {
      const prevRoundRef = doc(db, 'polls', pollId, 'rounds', prevRoundNumber.toString());
      await updateDoc(prevRoundRef, { status: 'closed' });
    } catch (e) {
      console.warn('Failed to close previous round:', e);
    }
  }

  const roundDocRef = doc(db, 'polls', pollId, 'rounds', nextRoundNumber.toString());
  const pollDocRef = doc(db, 'polls', pollId);

  await setDoc(roundDocRef, {
    ...cleanFirestoreData(nextRound),
    createdAt: serverTimestamp(),
  });

  await updateDoc(pollDocRef, {
    currentRound: nextRoundNumber,
    totalRounds: nextRoundNumber,
    updatedAt: serverTimestamp(),
  });

  return nextRoundNumber;
}

/**
 * Updates poll results visibility (public or admin only).
 */
export async function updatePollVisibility(pollId: string, isPublicResult: boolean): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    const polls = getMockPolls();
    if (polls[pollId]) {
      polls[pollId].isPublicResult = isPublicResult;
      polls[pollId].updatedAt = new Date().toISOString();
      saveMockPolls(polls);
    }
    return;
  }

  const pollDocRef = doc(db, 'polls', pollId);
  await updateDoc(pollDocRef, {
    isPublicResult,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Updates poll voter names breakdown visibility (show / hide who voted for what).
 */
export async function updatePollVoterNamesVisibility(
  pollId: string,
  showVoterNames: boolean
): Promise<void> {
  const nowIso = new Date().toISOString();
  if (!isFirebaseConfigured || !db) {
    const polls = getMockPolls();
    if (polls[pollId]) {
      polls[pollId].showVoterNames = showVoterNames;
      polls[pollId].updatedAt = nowIso;
      saveMockPolls(polls);
    }
    return;
  }

  const pollDocRef = doc(db, 'polls', pollId);
  await updateDoc(pollDocRef, {
    showVoterNames,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Updates overall poll status (active / closed / archived).
 */
export async function updatePollStatus(
  pollId: string,
  status: 'active' | 'closed' | 'archived'
): Promise<void> {
  const nowIso = new Date().toISOString();
  if (!isFirebaseConfigured || !db) {
    const polls = getMockPolls();
    if (polls[pollId]) {
      polls[pollId].status = status;
      polls[pollId].updatedAt = nowIso;
      saveMockPolls(polls);
    }
    return;
  }

  const pollDocRef = doc(db, 'polls', pollId);
  await updateDoc(pollDocRef, {
    status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Updates round status (open / closed).
 */
export async function updateRoundStatus(
  pollId: string,
  roundNumber: number,
  status: 'scheduled' | 'open' | 'closed'
): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    const rounds = getMockRounds();
    if (rounds[pollId]?.[roundNumber]) {
      rounds[pollId][roundNumber].status = status;
      saveMockRounds(rounds);
    }
    return;
  }

  const roundDocRef = doc(db, 'polls', pollId, 'rounds', roundNumber.toString());
  await updateDoc(roundDocRef, { status });
}

/**
 * Adds candidate dates to an existing schedule round (admin only).
 * Duplicates are skipped, options are stored sorted oldest first and maxChoices follows the option count.
 * Throws ScheduleCandidateLimitError when the total would exceed 30.
 * Returns the number of added candidates.
 */
export async function addScheduleOptions(
  pollId: string,
  roundNumber: number,
  lines: string[]
): Promise<{ addedCount: number; skippedCount: number }> {
  const refDate = new Date();

  if (!isFirebaseConfigured || !db) {
    const rounds = getMockRounds();
    const round = rounds[pollId]?.[roundNumber];
    if (!round) throw new Error('ラウンドが見つかりません');
    const merged = mergeScheduleCandidates(round.options, lines, refDate);
    rounds[pollId][roundNumber] = { ...round, options: merged.options, maxChoices: merged.options.length };
    saveMockRounds(rounds);
    return { addedCount: merged.added.length, skippedCount: merged.skipped.length };
  }

  const firestore = db;
  const roundDocRef = doc(firestore, 'polls', pollId, 'rounds', roundNumber.toString());
  return runTransaction(firestore, async tx => {
    const snap = await tx.get(roundDocRef);
    if (!snap.exists()) throw new Error('ラウンドが見つかりません');
    const current = (snap.data().options || []) as PollRound['options'];
    const merged = mergeScheduleCandidates(current, lines, refDate);
    if (merged.added.length > 0) {
      tx.update(roundDocRef, {
        options: cleanFirestoreData(merged.options),
        maxChoices: merged.options.length,
      });
    }
    return { addedCount: merged.added.length, skippedCount: merged.skipped.length };
  });
}

/**
 * Sets (or clears with null) the confirmed event date of a schedule poll. Admin only.
 */
export async function setPollDecision(pollId: string, decision: ScheduleDecision | null): Promise<void> {
  const nowIso = new Date().toISOString();
  if (!isFirebaseConfigured || !db) {
    const polls = getMockPolls();
    if (polls[pollId]) {
      polls[pollId].decision = decision;
      polls[pollId].updatedAt = nowIso;
      saveMockPolls(polls);
    }
    return;
  }

  await updateDoc(doc(db, 'polls', pollId), {
    decision: decision ? cleanFirestoreData(decision) : null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Normalizes event meta info (trims, validates URL to http(s) only).
 */
export function normalizeEventInfo(info: PollEventInfo): Required<PollEventInfo> {
  return {
    location: (info.location || '').trim().slice(0, 200),
    locationUrl: sanitizeHttpUrl(info.locationUrl).slice(0, 1000),
    fee: (info.fee || '').trim().slice(0, 100),
    notes: (info.notes || '').trim().slice(0, 1000),
    capacity: normalizeCapacity(info.capacity),
  };
}

/**
 * Updates event meta info (location / map URL / fee / notes). Admin only.
 */
export async function updatePollEventInfo(pollId: string, info: PollEventInfo): Promise<void> {
  const normalized = normalizeEventInfo(info);
  const nowIso = new Date().toISOString();
  if (!isFirebaseConfigured || !db) {
    const polls = getMockPolls();
    if (polls[pollId]) {
      polls[pollId] = { ...polls[pollId], ...normalized, updatedAt: nowIso };
      saveMockPolls(polls);
    }
    return;
  }

  await updateDoc(doc(db, 'polls', pollId), {
    ...normalized,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Retrieves polls created by the specified user.
 */
export async function getUserCreatedPolls(userId: string): Promise<Poll[]> {
  if (!userId) return [];

  if (!isFirebaseConfigured || !db) {
    const polls = getMockPolls();
    return Object.values(polls)
      .filter(p => p.creatorUid === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  try {
    const pollsColRef = collection(db, 'polls');
    const q = query(pollsColRef, where('creatorUid', '==', userId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        ...(data as Poll),
        id: d.id,
        createdAt: toIsoDate(data.createdAt),
        updatedAt: toIsoDate(data.updatedAt),
      };
    });
  } catch (err) {
    console.error('Error getting user created polls:', err);
    // Fallback if composite index is pending
    try {
      const qFallback = query(collection(db, 'polls'), where('creatorUid', '==', userId));
      const snap = await getDocs(qFallback);
      return snap.docs
        .map(d => ({
          ...(d.data() as Poll),
          id: d.id,
          createdAt: toIsoDate(d.data().createdAt),
          updatedAt: toIsoDate(d.data().updatedAt),
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }
}

/**
 * Fetches a single poll by ID.
 */
export async function getPoll(pollId: string): Promise<Poll | null> {
  if (!pollId) return null;

  if (!isFirebaseConfigured || !db) {
    const polls = getMockPolls();
    return polls[pollId] || null;
  }

  try {
    const pollDocRef = doc(db, 'polls', pollId);
    const docSnap = await getDoc(pollDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...(data as Poll),
        requireAuth: data.requireAuth !== false,
        showVoterNames: data.showVoterNames === true,
        id: docSnap.id,
        createdAt: toIsoDate(data.createdAt),
        updatedAt: toIsoDate(data.updatedAt),
      };
    }
    return null;
  } catch (err) {
    console.error(`Error fetching poll ${pollId}:`, err);
    return null;
  }
}

/**
 * Retrieves public polls that have been accessed / opened by this client.
 * If the user has not accessed any poll URL/ID, returns an empty array.
 */
export async function getPublicPolls(): Promise<Poll[]> {
  const accessedIds = getAccessedPollIds();
  if (accessedIds.length === 0) {
    return [];
  }

  if (!isFirebaseConfigured || !db) {
    const polls = getMockPolls();
    return accessedIds
      .map(id => polls[id])
      .filter((p): p is Poll => Boolean(p))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  try {
    const pollPromises = accessedIds.map(id => getPoll(id));
    const results = await Promise.all(pollPromises);
    const validPolls = results.filter((p): p is Poll => p !== null);
    return validPolls.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    console.error('Error fetching accessed public polls:', err);
    return [];
  }
}

/**
 * Deletes a poll and all its associated rounds and votes.
 * Only the creator is authorized to delete the poll.
 */
export async function deletePoll(pollId: string, currentUserId?: string): Promise<void> {
  if (!pollId) return;

  if (!isFirebaseConfigured || !db) {
    const polls = getMockPolls();
    const poll = polls[pollId];
    if (poll && currentUserId && poll.creatorUid !== currentUserId) {
      throw new Error('投票を削除する権限がありません');
    }

    if (polls[pollId]) {
      delete polls[pollId];
      saveMockPolls(polls);
    }

    const rounds = getMockRounds();
    if (rounds[pollId]) {
      delete rounds[pollId];
      saveMockRounds(rounds);
    }

    const votes = getMockVotes();
    if (votes[pollId]) {
      delete votes[pollId];
      saveMockVotes(votes);
    }

    const secrets = getMockVoteSecrets();
    for (const key of Object.keys(secrets)) {
      if (key.startsWith(`${pollId}/`)) delete secrets[key];
    }
    saveMockVoteSecrets(secrets);

    removeAccessedPoll(pollId);
    return;
  }

  // Check authorization in Firestore
  const pollDocRef = doc(db, 'polls', pollId);
  const snap = await getDoc(pollDocRef);
  if (snap.exists()) {
    const data = snap.data();
    if (currentUserId && data.creatorUid && data.creatorUid !== currentUserId) {
      throw new Error('投票を削除する権限がありません');
    }
  }

  // Delete all rounds and their votes subcollections
  try {
    const roundsColRef = collection(db, 'polls', pollId, 'rounds');
    const roundsSnap = await getDocs(roundsColRef);
    for (const roundDoc of roundsSnap.docs) {
      try {
        const votesColRef = collection(db, 'polls', pollId, 'rounds', roundDoc.id, 'votes');
        const votesSnap = await getDocs(votesColRef);
        for (const voteDoc of votesSnap.docs) {
          await deleteDoc(voteDoc.ref);
        }
      } catch (e) {
        console.warn(`Error deleting votes for round ${roundDoc.id}:`, e);
      }
      for (const sub of ['voteSecrets', 'voteProofs']) {
        try {
          const subSnap = await getDocs(collection(db, 'polls', pollId, 'rounds', roundDoc.id, sub));
          for (const subDoc of subSnap.docs) {
            await deleteDoc(subDoc.ref);
          }
        } catch (e) {
          console.warn(`Error deleting ${sub} for round ${roundDoc.id}:`, e);
        }
      }
      await deleteDoc(roundDoc.ref);
    }
  } catch (err) {
    console.warn('Error deleting subcollections for poll:', err);
  }

  await deleteDoc(pollDocRef);
  removeAccessedPoll(pollId);
}
