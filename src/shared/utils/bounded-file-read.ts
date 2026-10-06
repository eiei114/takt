import { readSync } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';

/** Validates the byte limit and allocates one extra byte to detect oversized content. */
function allocateReadBuffer(maxBytes: number): Buffer {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError('maxBytes must be a nonnegative safe integer');
  }
  // One extra byte distinguishes exact-limit content from an oversized file.
  return Buffer.alloc(maxBytes + 1);
}

/** Read from offset zero with bounded allocation/I/O; null means oversized. */
export async function readBoundedFile(handle: FileHandle, maxBytes: number): Promise<Buffer | null> {
  const buffer = allocateReadBuffer(maxBytes);
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesRead } = await handle.read({
      buffer, offset, length: buffer.length - offset, position: offset,
    });
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  return offset > maxBytes ? null : buffer.subarray(0, offset);
}

/** Synchronous counterpart with the same byte limit, including short reads. */
export function readBoundedFileSync(descriptor: number, maxBytes: number): Buffer | null {
  const buffer = allocateReadBuffer(maxBytes);
  let offset = 0;
  while (offset < buffer.length) {
    const bytesRead = readSync(descriptor, buffer, {
      offset, length: buffer.length - offset, position: offset,
    });
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  return offset > maxBytes ? null : buffer.subarray(0, offset);
}
