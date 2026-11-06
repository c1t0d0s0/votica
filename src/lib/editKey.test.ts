import { describe, it, expect } from 'vitest';
import { computeProof, computeSecretHash, sha256Hex } from './editKey';

describe('editKey', () => {
  it('computes sha256 as lowercase hex', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('derives deterministic proofs bound to poll and vote ids', async () => {
    const a = await computeProof('poll_1', 'anon_1', 'secret');
    expect(a).toBe(await computeProof('poll_1', 'anon_1', 'secret'));
    expect(a).not.toBe(await computeProof('poll_1', 'anon_2', 'secret'));
    expect(a).not.toBe(await computeProof('poll_2', 'anon_1', 'secret'));
    expect(a).toHaveLength(64);
    const hash = await computeSecretHash(a);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(a);
  });
});
