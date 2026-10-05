/** JSON-safe filesystem identity; retain legacy numbers only when lossless. */
export type PersistedFilesystemId = number | string;

/** Validate canonical unsigned decimal IDs without accepting rounded numbers. */
export function isPersistedFilesystemId(value: unknown): value is PersistedFilesystemId {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    || typeof value === 'string' && /^(?:0|[1-9]\d{0,19})$/.test(value)
      && BigInt(value) <= 0xffffffffffffffffn;
}

/** Preserve every inode/device bit while retaining the safe numeric wire format. */
export function persistFilesystemId(value: bigint): PersistedFilesystemId {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : value.toString();
}
