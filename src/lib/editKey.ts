/**
 * Edit-key (password) helpers for no-login (anonymous) schedule responses.
 *
 * Scheme (verified by Firestore Security Rules, no backend required):
 *   proof = sha256hex(`${pollId}:${voteId}:${password}`)    -- computed on the client, never published
 *   hash  = sha256hex(proof)                                 -- stored in rounds/{r}/voteSecrets/{voteId} (read: false)
 * When editing/deleting, the client writes `proof` to rounds/{r}/voteProofs/{voteId} (read: false)
 * in the same batch, and the rules check sha256(proof) == hash.
 *
 * If the voter does not set a password, a random per-device key is used instead,
 * so the same device can keep editing seamlessly.
 */

const DEVICE_KEY_STORAGE = 'votica_anon_editkey';
const PROOF_CACHE_STORAGE = 'votica_vote_proofs';

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function computeProof(pollId: string, voteId: string, password: string): Promise<string> {
  return sha256Hex(`${pollId}:${voteId}:${password}`);
}

export function computeSecretHash(proof: string): Promise<string> {
  return sha256Hex(proof);
}

function randomKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Returns (and lazily creates) the random per-device edit key. */
export function getDeviceEditKey(): string {
  try {
    let key = localStorage.getItem(DEVICE_KEY_STORAGE);
    if (!key) {
      key = randomKey();
      localStorage.setItem(DEVICE_KEY_STORAGE, key);
    }
    return key;
  } catch {
    return randomKey();
  }
}

function proofCacheKey(pollId: string, roundNumber: number, voteId: string): string {
  return `${pollId}/${roundNumber}/${voteId}`;
}

function readProofCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PROOF_CACHE_STORAGE);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Remembers a verified proof on this device so the user is not asked for the password again. */
export function rememberProof(pollId: string, roundNumber: number, voteId: string, proof: string): void {
  try {
    const cache = readProofCache();
    cache[proofCacheKey(pollId, roundNumber, voteId)] = proof;
    const entries = Object.entries(cache);
    // Keep the cache bounded
    const trimmed = Object.fromEntries(entries.slice(Math.max(0, entries.length - 200)));
    localStorage.setItem(PROOF_CACHE_STORAGE, JSON.stringify(trimmed));
  } catch {}
}

export function getRememberedProof(pollId: string, roundNumber: number, voteId: string): string | null {
  return readProofCache()[proofCacheKey(pollId, roundNumber, voteId)] || null;
}

export function forgetProof(pollId: string, roundNumber: number, voteId: string): void {
  try {
    const cache = readProofCache();
    delete cache[proofCacheKey(pollId, roundNumber, voteId)];
    localStorage.setItem(PROOF_CACHE_STORAGE, JSON.stringify(cache));
  } catch {}
}

export class InvalidEditKeyError extends Error {
  constructor(message = 'INVALID_EDIT_KEY') {
    super(message);
    this.name = 'InvalidEditKeyError';
  }
}
