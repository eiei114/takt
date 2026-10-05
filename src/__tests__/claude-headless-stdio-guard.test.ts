import { describe, it, expect, vi, beforeEach } from 'vitest';

// Construct native absolute fixture paths without mocking production path handling.
const nativeFixturePath = await vi.hoisted(async () => (await import('node:path')).resolve);
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';

// Match the process seam used by the Windows cross-platform spawn wrapper.
vi.mock('cross-spawn', async () => ({
  default: (await import('node:child_process')).spawn,
}));

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'node:child_process';
import { runHeadlessCli } from '../infra/claude-headless/headless-spawn.js';
import type { ClaudeHeadlessCallOptions } from '../infra/claude-headless/types.js';

function stubSpawn(opts: {
  stdoutError?: Error;
  stderrError?: Error;
  closeCode?: number | null;
}): void {
  vi.mocked(spawn).mockImplementation(() => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const proc = new EventEmitter() as EventEmitter & Partial<ChildProcess>;
    proc.stdout = stdout;
    proc.stderr = stderr;
    proc.stdin = null;
    proc.kill = vi.fn() as unknown as ChildProcess['kill'];

    queueMicrotask(() => {
      if (opts.stdoutError) {
        stdout.emit('error', opts.stdoutError);
      }
      if (opts.stderrError) {
        stderr.emit('error', opts.stderrError);
      }
      proc.emit('close', opts.closeCode ?? 1, null);
    });

    return proc as ChildProcess;
  });
}

describe('runHeadlessCli stdio guard', () => {
  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it('rejects with a failure without crashing the parent process when stdout emits a stream error', async () => {
    stubSpawn({
      stdoutError: new Error('stdout pipe closed'),
      closeCode: null,
    });

    const options: ClaudeHeadlessCallOptions = { cwd: nativeFixturePath('/tmp') };

    await expect(runHeadlessCli(['-p', '--', 'prompt'], options)).rejects.toThrow(
      /stdout stream error: stdout pipe closed/u,
    );
  });

  it('rejects with a failure when stderr emits a stream error', async () => {
    stubSpawn({
      stderrError: new Error('stderr pipe closed'),
      closeCode: 1,
    });

    const options: ClaudeHeadlessCallOptions = { cwd: nativeFixturePath('/tmp') };

    await expect(runHeadlessCli(['-p', '--', 'prompt'], options)).rejects.toThrow(
      /stderr stream error: stderr pipe closed/u,
    );
  });

  it('guards stdout and stderr even though the headless spawn has no stdin', async () => {
    stubSpawn({
      stdoutError: new Error('stdout pipe closed'),
      closeCode: 1,
    });

    const options: ClaudeHeadlessCallOptions = { cwd: nativeFixturePath('/tmp') };

    await expect(runHeadlessCli(['-p', '--', 'prompt'], options)).rejects.toThrow(
      /stdout stream error: stdout pipe closed/u,
    );
  });
});
