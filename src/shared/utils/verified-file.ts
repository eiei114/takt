import { constants, type BigIntStats } from 'node:fs';
import { lstat, open, realpath, type FileHandle } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export interface FileIdentity {
  readonly dev: bigint;
  readonly ino: bigint;
}

export interface VerifiedRegularFile {
  readonly handle: FileHandle;
  readonly identity: FileIdentity;
  /** Recheck before publishing read results; appending to the same inode is allowed. */
  assertIdentity(): Promise<void>;
}

function sameIdentity(expected: FileIdentity, actual: FileIdentity): boolean {
  return expected.dev === actual.dev && expected.ino === actual.ino;
}

/**
 * Open a canonical regular file whose handle matches the inspected identity,
 * rejecting observed links and identity changes before any content is read.
 * POSIX retains atomic O_NOFOLLOW. Windows, where that flag is
 * unavailable, verifies the opened handle against lossless lstat identities
 * and rechecks every ancestor instead of trusting a pathname-only check.
 * This is identity verification, not a Windows atomic no-follow flag or sandbox.
 * Callers must recheck identity after reading and close the handle in finally.
 */
export async function openVerifiedRegularFile(path: string, label: string): Promise<VerifiedRegularFile> {
  const noFollow = (constants as { readonly O_NOFOLLOW?: number }).O_NOFOLLOW;
  if (noFollow === undefined && process.platform !== 'win32') {
    throw new Error(`${label} cannot be opened safely on this platform`);
  }
  const expectedPath = resolve(path);
  const ancestors: { readonly path: string; readonly stat: BigIntStats }[] = [];
  const parentPaths: string[] = [];
  for (let parent = dirname(expectedPath); ; parent = dirname(parent)) {
    parentPaths.push(parent);
    if (dirname(parent) === parent) break;
  }
  for (const parent of parentPaths.reverse()) {
    const stat = await lstat(parent, { bigint: true });
    if (stat.isSymbolicLink()) throw new Error(`${label} contains a symbolic link: ${parent}`);
    if (!stat.isDirectory()) throw new Error(`${label} ancestor must be a directory: ${parent}`);
    ancestors.push({ path: parent, stat });
  }
  const expected = await lstat(expectedPath, { bigint: true });
  if (expected.isSymbolicLink()) throw new Error(`${label} contains a symbolic link`);
  if (!expected.isFile()) throw new Error(`${label} must be a regular file`);
  if (await realpath(expectedPath) !== expectedPath) throw new Error(`${label} contains a symbolic link`);

  const handle = await open(expectedPath, constants.O_RDONLY | (noFollow ?? 0));
  const assertIdentity = async (): Promise<void> => {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameIdentity(expected, opened)) {
      throw new Error(`${label} file identity changed while reading`);
    }
    for (const ancestor of ancestors) {
      const current = await lstat(ancestor.path, { bigint: true });
      if (current.isSymbolicLink()) throw new Error(`${label} contains a symbolic link`);
      if (!current.isDirectory() || !sameIdentity(ancestor.stat, current)) {
        throw new Error(`${label} ancestor identity changed while reading`);
      }
    }
    const current = await lstat(expectedPath, { bigint: true });
    if (current.isSymbolicLink() || await realpath(expectedPath) !== expectedPath) {
      throw new Error(`${label} contains a symbolic link`);
    }
    if (!current.isFile() || !sameIdentity(expected, current)) {
      throw new Error(`${label} file identity changed while reading`);
    }
  };
  try {
    await assertIdentity();
    return {
      handle,
      identity: { dev: expected.dev, ino: expected.ino },
      assertIdentity,
    };
  } catch (error) {
    await handle.close();
    throw error;
  }
}
