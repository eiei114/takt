import { describe, expect, it } from 'vitest';
import { isPersistedFilesystemId, persistFilesystemId } from '../shared/utils/filesystem-identity.js';

describe('persisted filesystem identity', () => {
  it('retains safe legacy numbers and losslessly encodes large inodes', () => {
    expect(persistFilesystemId(123n)).toBe(123);
    expect(persistFilesystemId(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    const first = 9007199254740992n;
    expect(persistFilesystemId(first)).toBe('9007199254740992');
    expect(persistFilesystemId(first + 1n)).toBe('9007199254740993');
    expect(persistFilesystemId(0xffffffffffffffffn)).toBe('18446744073709551615');
  });

  it('accepts only lossless unsigned identities', () => {
    for (const value of [0, 123, Number.MAX_SAFE_INTEGER, '0', '123', '18446744073709551615']) {
      expect(isPersistedFilesystemId(value)).toBe(true);
    }
    for (const value of [Number.MAX_SAFE_INTEGER + 1, -1, 1.5, NaN, Infinity,
      '', '01', '-1', '1.5', '1e3', '18446744073709551616', '9'.repeat(100), null, {}]) {
      expect(isPersistedFilesystemId(value)).toBe(false);
    }
  });
});
