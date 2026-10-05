import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { link, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openVerifiedRegularFile } from '../shared/utils/verified-file.js';
import { readRunLogArtifactsForDiagnostics } from '../features/web-ui/run-log-cache.js';

const control = vi.hoisted(() => ({
  beforeOpen: undefined as (() => Promise<void>) | undefined,
  filePath: '',
  inode: undefined as bigint | undefined,
  handleInodeDelta: 0n,
  birthtimeDelta: 0n,
  freezeModifiedAt: false,
  noFollowUnavailable: false,
  opened: [] as FileHandle[],
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    constants: {
      ...actual.constants,
      get O_NOFOLLOW() {
        return control.noFollowUnavailable ? undefined : actual.constants.O_NOFOLLOW;
      },
    },
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    lstat: (async (...args: Parameters<typeof actual.lstat>) => {
      const stat = await actual.lstat(...args);
      if (String(args[0]) === control.filePath && 'birthtimeNs' in stat) {
        if (control.inode !== undefined) stat.ino = control.inode;
        stat.birthtimeNs += control.birthtimeDelta;
      }
      return stat;
    }) as typeof actual.lstat,
    open: async (...args: Parameters<typeof actual.open>) => {
      const beforeOpen = control.beforeOpen;
      control.beforeOpen = undefined;
      await beforeOpen?.();
      const handle = await actual.open(...args);
      control.opened.push(handle);
      vi.spyOn(handle, 'read');
      vi.spyOn(handle, 'readFile');
      vi.spyOn(handle, 'close');
      const originalStat = handle.stat.bind(handle);
      vi.spyOn(handle, 'stat').mockImplementation((async (options?: { bigint?: boolean }) => {
        if (options?.bigint) {
          const stat = await originalStat({ bigint: true });
          if (control.inode !== undefined) stat.ino = control.inode + control.handleInodeDelta;
          stat.birthtimeNs += control.birthtimeDelta;
          return stat;
        }
        const stat = await originalStat();
        if (control.freezeModifiedAt) stat.mtimeMs = 0;
        return stat;
      }) as FileHandle['stat']);
      return handle;
    },
  };
});

describe('verified regular file reads', () => {
  let root: string;
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;

  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'takt-verified-file-')));
    control.beforeOpen = undefined;
    control.filePath = '';
    control.inode = undefined;
    control.handleInodeDelta = 0n;
    control.birthtimeDelta = 0n;
    control.freezeModifiedAt = false;
    control.noFollowUnavailable = false;
    control.opened = [];
  });

  afterEach(async () => {
    Object.defineProperty(process, 'platform', originalPlatform);
    for (const handle of control.opened) await handle.close().catch(() => undefined);
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  function expectNoContentRead(): void {
    for (const handle of control.opened) {
      expect(handle.read).not.toHaveBeenCalled();
      expect(handle.readFile).not.toHaveBeenCalled();
      expect(handle.close).toHaveBeenCalledOnce();
    }
  }

  it('reads a real regular file and permits append-only changes on the same inode', async () => {
    const path = join(root, 'record');
    await writeFile(path, 'public');
    control.filePath = path;
    const opened = await openVerifiedRegularFile(path, 'Artifact');
    try {
      expect(opened.identity.ino).toBe((await lstat(path, { bigint: true })).ino);
      expect(await opened.handle.readFile('utf8')).toBe('public');
      await writeFile(path, 'public append');
      // Node can expose a changing ctime when the filesystem has no birthtime.
      // Metadata timestamps must not be mistaken for physical file identity.
      control.birthtimeDelta = 1n;
      await expect(opened.assertIdentity()).resolves.toBeUndefined();
    } finally {
      await opened.handle.close();
    }
  });

  it('rejects a file symlink without reading its external target', async () => {
    const outside = join(root, 'outside');
    const path = join(root, 'linked');
    await writeFile(outside, 'external secret');
    await symlink(outside, path);
    await expect(openVerifiedRegularFile(path, 'Artifact')).rejects.toThrow(/symbolic link/);
    expect(control.opened).toHaveLength(0);
  });

  it('rejects a symlinked ancestor and a directory used as a file', async () => {
    const outside = join(root, 'outside');
    await mkdir(outside);
    await writeFile(join(outside, 'record'), 'external secret');
    await symlink(outside, join(root, 'linked'), 'dir');
    await expect(openVerifiedRegularFile(join(root, 'linked', 'record'), 'Artifact'))
      .rejects.toThrow(/symbolic link/);
    await expect(openVerifiedRegularFile(outside, 'Artifact')).rejects.toThrow(/regular file/);
    expect(control.opened).toHaveLength(0);
  });

  it('rejects ordinary file replacement between inspection and open before reading bytes', async () => {
    const path = join(root, 'record');
    await writeFile(path, 'public');
    control.beforeOpen = async () => {
      await rename(path, join(root, 'original'));
      await writeFile(path, 'replacement secret');
    };
    await expect(openVerifiedRegularFile(path, 'Artifact')).rejects.toThrow(/file identity changed/);
    expectNoContentRead();
  });

  it('rejects symlink replacement between inspection and open before reading external bytes', async () => {
    const path = join(root, 'record');
    const outside = join(root, 'outside');
    await writeFile(path, 'public');
    await writeFile(outside, 'external secret');
    control.beforeOpen = async () => {
      await rename(path, join(root, 'original'));
      await symlink(outside, path);
    };
    await expect(openVerifiedRegularFile(path, 'Artifact')).rejects.toThrow(/identity changed|ELOOP|symbolic link/);
    expectNoContentRead();
  });

  it('detects an ancestor swap even when a hard link preserves the file inode', async () => {
    const parent = join(root, 'parent');
    const original = join(root, 'original-parent');
    await mkdir(parent);
    const path = join(parent, 'record');
    await writeFile(path, 'public');
    control.beforeOpen = async () => {
      await rename(parent, original);
      await mkdir(parent);
      await link(join(original, 'record'), path);
    };
    await expect(openVerifiedRegularFile(path, 'Artifact')).rejects.toThrow(/ancestor identity changed/);
    expectNoContentRead();
  });

  it('does not round neighboring large inode IDs when verifying an open handle', async () => {
    const path = join(root, 'record');
    await writeFile(path, 'public');
    control.filePath = path;
    control.inode = 9007199254740992n;
    control.handleInodeDelta = 1n;
    expect(Number(control.inode)).toBe(Number(control.inode + 1n));
    await expect(openVerifiedRegularFile(path, 'Artifact')).rejects.toThrow(/file identity changed/);
    expectNoContentRead();
  });

  it('rejects replacement after reading before publishing the result', async () => {
    const path = join(root, 'record');
    await writeFile(path, 'public');
    const opened = await openVerifiedRegularFile(path, 'Artifact');
    try {
      expect(await opened.handle.readFile('utf8')).toBe('public');
      await rename(path, join(root, 'original'));
      await writeFile(path, 'replacement secret');
      await expect(opened.assertIdentity()).rejects.toThrow(/file identity changed/);
      expect(await readFile(join(root, 'original'), 'utf8')).toBe('public');
    } finally {
      await opened.handle.close();
    }
  });

  it('fails closed on other platforms when no-follow opening is unavailable', async () => {
    const path = join(root, 'record');
    await writeFile(path, 'public');
    control.noFollowUnavailable = true;
    Object.defineProperty(process, 'platform', { value: 'aix', configurable: true });
    await expect(openVerifiedRegularFile(path, 'Artifact')).rejects.toThrow(/cannot be opened safely/);
    expect(control.opened).toHaveLength(0);
  });

  it('invalidates the log cache for neighboring large inode IDs even with equal size and timestamp', async () => {
    const path = join(root, 'session.jsonl');
    const first = `${JSON.stringify({ type: 'step_start', step: 'aaaa', iteration: 1 })}\n`;
    const second = `${JSON.stringify({ type: 'step_start', step: 'bbbb', iteration: 1 })}\n`;
    expect(first.length).toBe(second.length);
    control.filePath = path;
    control.inode = 9007199254740992n;
    control.freezeModifiedAt = true;
    await writeFile(path, first);
    const verifySnapshot = async (): Promise<void> => {};
    const initial = await readRunLogArtifactsForDiagnostics(root, [path], verifySnapshot);
    expect(initial.events.map((event) => event.step)).toEqual(['aaaa']);
    control.inode += 1n;
    await writeFile(path, second);
    const replaced = await readRunLogArtifactsForDiagnostics(root, [path], verifySnapshot);
    expect(replaced.events.map((event) => event.step)).toEqual(['bbbb']);
    expect(replaced.scan.bytesRead).toBe(Buffer.byteLength(second));
  });
});
