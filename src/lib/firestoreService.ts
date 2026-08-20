import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { Poll, PollRound, Vote } from './types';

// Mock storage keys for offline/demo mode
const MOCK_POLLS_KEY = 'votica_mock_polls';
const MOCK_ROUNDS_KEY = 'votica_mock_rounds';
const MOCK_VOTES_KEY = 'votica_mock_votes';

// Helper for converting Firestore timestamp or ISO string to ISO string
function toIsoDate(val: any): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return new Date(val).toISOString();
  return new Date().toISOString();
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
  localStorage.setItem(MOCK_POLLS_KEY, JSON.stringify(polls));
  window.dispatchEvent(new Event('votica_mock_update'));
}

function getMockRounds(): Record<string, Record<number, PollRound>> {
  try {
    return JSON.parse(localStorage.getItem(MOCK_ROUNDS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveMockRounds(rounds: Record<string, Record<number, PollRound>>) {
  localStorage.setItem(MOCK_ROUNDS_KEY, JSON.stringify(rounds));
  window.dispatchEvent(new Event('votica_mock_update'));
}

function getMockVotes(): Record<string, Record<number, Record<string, Vote>>> {
  try {
    return JSON.parse(localStorage.getItem(MOCK_VOTES_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveMockVotes(votes: Record<string, Record<number, Record<string, Vote>>>) {
  localStorage.setItem(MOCK_VOTES_KEY, JSON.stringify(votes));
  window.dispatchEvent(new Event('votica_mock_update'));
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

    return pollId;
  }

  // Firestore transaction / batch writes
  const pollDocRef = doc(db, 'polls', pollId);
  const round1DocRef = doc(db, 'polls', pollId, 'rounds', '1');

  await setDoc(pollDocRef, {
    ...newPoll,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(round1DocRef, {
    ...newRound1,
    createdAt: serverTimestamp(),
  });

  return pollId;
}

/**
 * Subscribes to real-time updates for a single poll.
 */
export function subscribePoll(pollId: string, callback: (poll: Poll | null) => void): () => void {
  if (!isFirebaseConfigured || !db) {
    const check = () => {
      const polls = getMockPolls();
      callback(polls[pollId] || null);
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
        callback({
          ...(data as Poll),
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
 * Casts or updates a vote for the specified user and round.
 * 1 vote per user is enforced by writing to doc `rounds/{roundNumber}/votes/{userId}`.
 */
export async function castVote(
  pollId: string,
  roundNumber: number,
  vote: Omit<Vote, 'id' | 'votedAt'>
): Promise<void> {
  const nowIso = new Date().toISOString();
  const voteDocData: Vote = {
    ...vote,
    id: vote.userId,
    votedAt: nowIso,
  };

  if (!isFirebaseConfigured || !db) {
    const allVotes = getMockVotes();
    if (!allVotes[pollId]) allVotes[pollId] = {};
    if (!allVotes[pollId][roundNumber]) allVotes[pollId][roundNumber] = {};
    allVotes[pollId][roundNumber][vote.userId] = voteDocData;
    saveMockVotes(allVotes);
    return;
  }

  const voteDocRef = doc(db, 'polls', pollId, 'rounds', roundNumber.toString(), 'votes', vote.userId);
  await setDoc(voteDocRef, {
    ...voteDocData,
    votedAt: serverTimestamp(),
  });
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
    createdAt: nowIso,
  };

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
    rounds[pollId][nextRoundNumber] = nextRound;
    saveMockRounds(rounds);

    return nextRoundNumber;
  }

  const roundDocRef = doc(db, 'polls', pollId, 'rounds', nextRoundNumber.toString());
  const pollDocRef = doc(db, 'polls', pollId);

  await setDoc(roundDocRef, {
    ...nextRound,
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
 * Retrieves public polls.
 */
export async function getPublicPolls(): Promise<Poll[]> {
  if (!isFirebaseConfigured || !db) {
    const polls = getMockPolls();
    return Object.values(polls)
      .filter(p => p.isPublicResult || p.status === 'active')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  try {
    const pollsColRef = collection(db, 'polls');
    const q = query(pollsColRef, where('isPublicResult', '==', true));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({
        ...(d.data() as Poll),
        id: d.id,
        createdAt: toIsoDate(d.data().createdAt),
        updatedAt: toIsoDate(d.data().updatedAt),
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error('Error fetching public polls:', err);
    return [];
  }
}
