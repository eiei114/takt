import { closeSync, openSync } from 'node:fs';
import { format } from 'node:util';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Terminal } from '@xterm/headless';

// StatusLine is a singleton — import the same instance used by production code
import { statusLine } from '../shared/ui/StatusLine.js';
import { StreamDisplay } from '../shared/ui/StreamDisplay.js';

async function readTerminalText(output: string): Promise<string> {
  const terminal = new Terminal({ cols: 120, rows: 30, allowProposedApi: true });
  try {
    const ttyOutput = output.replace(/\r?\n/gu, '\r\n');
    await new Promise<void>((resolve) => terminal.write(ttyOutput, resolve));
    const baseY = terminal.buffer.active.baseY;
    return Array.from({ length: terminal.rows }, (_, index) => (
      terminal.buffer.active.getLine(baseY + index)?.translateToString(true) ?? ''
    )).join('\n');
  } finally {
    terminal.dispose();
  }
}

describe('StatusLine', () => {
  let savedStdoutIsTTY: boolean | undefined;
  let savedStderrIsTTY: boolean | undefined;
  let savedStdoutFd: number;
  let savedStderrFd: number;
  let savedStdoutWrite: typeof process.stdout.write;
  let savedStderrWrite: typeof process.stderr.write;
  let stdoutFd: number;
  let stderrFd: number;
  let stdoutChunks: string[];
  let stderrChunks: string[];

  beforeEach(() => {
    savedStdoutIsTTY = process.stdout.isTTY;
    savedStderrIsTTY = process.stderr.isTTY;
    savedStdoutFd = process.stdout.fd;
    savedStderrFd = process.stderr.fd;
    savedStdoutWrite = process.stdout.write;
    savedStderrWrite = process.stderr.write;
    stdoutFd = openSync(process.execPath, 'r');
    stderrFd = openSync(fileURLToPath(import.meta.url), 'r');
    stdoutChunks = [];
    stderrChunks = [];

    // Capture stdout and stderr independently
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    Object.defineProperty(process.stderr, 'isTTY', { value: false, configurable: true });
    Object.defineProperty(process.stdout, 'fd', { value: stdoutFd, configurable: true });
    Object.defineProperty(process.stderr, 'fd', { value: stderrFd, configurable: true });
    process.stdout.write = ((chunk: unknown) => {
      stdoutChunks.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: unknown) => {
      stderrChunks.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
  });

  afterEach(() => {
    statusLine.stop();
    vi.useRealTimers();
    Object.defineProperty(process.stdout, 'isTTY', { value: savedStdoutIsTTY, configurable: true });
    Object.defineProperty(process.stderr, 'isTTY', { value: savedStderrIsTTY, configurable: true });
    Object.defineProperty(process.stdout, 'fd', { value: savedStdoutFd, configurable: true });
    Object.defineProperty(process.stderr, 'fd', { value: savedStderrFd, configurable: true });
    process.stdout.write = savedStdoutWrite;
    process.stderr.write = savedStderrWrite;
    closeSync(stdoutFd);
    closeSync(stderrFd);
  });

  it('should not start when stdout is not a TTY', () => {
    statusLine.stop();
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, configurable: true });

    statusLine.start('test');

    // Advance timers — no spinner should render
    vi.useFakeTimers();
    vi.advanceTimersByTime(200);
    vi.useRealTimers();

    expect(stdoutChunks).toEqual([]);
  });

  it.each([
    { name: 'without a newline', output: 'warning' },
    { name: 'with a newline', output: 'warning\n' },
  ])('keeps the stdout spinner visible after stderr output $name', async ({ output }) => {
    vi.useFakeTimers();
    statusLine.start('Working...');
    vi.advanceTimersByTime(80);

    process.stderr.write(output);
    expect(stdoutChunks).not.toContain('\r\x1b[K');
    vi.advanceTimersByTime(80);
    vi.useRealTimers();

    const stdoutTerminal = await readTerminalText(stdoutChunks.join(''));
    expect(stdoutTerminal).toContain('Working...');
    expect(stdoutTerminal).not.toContain('warning');
    expect(stderrChunks.join('')).toBe(output);
  });

  it('keeps the stdout spinner visible after newline-free output to a separate TTY', async () => {
    Object.defineProperty(process.stderr, 'isTTY', { value: true, configurable: true });
    vi.useFakeTimers();
    statusLine.start('Working...');
    vi.advanceTimersByTime(80);

    process.stderr.write('warning');
    expect(stdoutChunks).not.toContain('\r\x1b[K');
    vi.advanceTimersByTime(80);
    vi.useRealTimers();

    const stdoutTerminal = await readTerminalText(stdoutChunks.join(''));
    const stderrTerminal = await readTerminalText(stderrChunks.join(''));
    expect(stdoutTerminal).toContain('Working...');
    expect(stdoutTerminal).not.toContain('warning');
    expect(stderrTerminal).toContain('warning');
    expect(stderrChunks.join('')).toBe('warning');
  });

  it('does not overwrite partial stderr output when both streams share a TTY', async () => {
    const sharedChunks: string[] = [];
    Object.defineProperty(process.stderr, 'isTTY', { value: true, configurable: true });
    Object.defineProperty(process.stderr, 'fd', { value: stdoutFd, configurable: true });
    process.stdout.write = ((chunk: unknown) => {
      sharedChunks.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: unknown) => {
      sharedChunks.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    vi.useFakeTimers();
    statusLine.start('Working...');
    vi.advanceTimersByTime(80);
    expect(sharedChunks.join('')).toContain('Working...');

    process.stderr.write('warning');
    vi.advanceTimersByTime(80);
    statusLine.stop();
    vi.useRealTimers();

    const sharedTerminal = await readTerminalText(sharedChunks.join(''));
    expect(sharedTerminal).toContain('warning');
    expect(sharedTerminal).not.toContain('Working...');
  });

  it('should intercept stdout.write when started on TTY', () => {
    statusLine.start('Working...');

    // stdout.write should now be the wrapped version
    const wrappedWrite = process.stdout.write;
    expect(wrappedWrite).not.toBe(savedStdoutWrite);

    statusLine.stop();
    // After stop, stdout.write is restored — but to our test mock, not savedStdoutWrite,
    // because start() captured our mock as the "original"
  });

  it.each([
    {
      name: 'Japanese text',
      chunks: ['日本語の', 'ストリーム本文', 'を保持します。'],
    },
    {
      name: 'Markdown table',
      chunks: ['| 項目 | 値 |', '\n| --- | --- |\n| 名前 | ', 'タクト |'],
    },
    {
      name: 'JSON',
      chunks: ['{"name":', '"タクト",', '"active":true}'],
    },
    {
      name: 'four-chunk Japanese text, Markdown table, and JSON',
      chunks: ['日本語 ', '本文\n| 列A | 列B |\n', '{"項目": ', '"値"}\n'],
    },
  ])('preserves split $name text across spinner timer ticks in the rendered terminal', async ({ chunks }) => {
    vi.useFakeTimers();
    const display = new StreamDisplay('test-agent', false);
    statusLine.start('Working...');

    for (const chunk of chunks) {
      display.showText(chunk);
      vi.advanceTimersByTime(80);
    }
    display.flushText();
    statusLine.stop();
    vi.useRealTimers();

    const screen = await readTerminalText(stdoutChunks.join(''));
    expect(screen).toContain(chunks.join(''));
  });

  it('preserves split thinking across spinner timer ticks in the rendered terminal', async () => {
    vi.useFakeTimers();
    const display = new StreamDisplay('test-agent', false);
    statusLine.start('Thinking...');
    const chunks = ['思考 ', 'の断片\n続き ', 'です\n'];

    for (const chunk of chunks) {
      display.showThinking(chunk);
      vi.advanceTimersByTime(80);
    }
    display.flushThinking();
    statusLine.stop();
    vi.useRealTimers();

    const screen = await readTerminalText(stdoutChunks.join(''));
    expect(screen).toContain(chunks.join(''));
  });

  it('preserves tool output while the status line spinner is active', async () => {
    vi.useFakeTimers();
    const display = new StreamDisplay('test-agent', false);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation((...args) => {
      process.stdout.write(`${format(...args)}\n`);
    });
    try {
      statusLine.start('Working...');
      display.showToolUse('Bash', { command: 'ls' });
      vi.advanceTimersByTime(80);
      display.showToolOutput('tool output\n');
      display.showToolResult('done', false);
      display.flush();
      statusLine.stop();
      vi.useRealTimers();

      const screen = await readTerminalText(stdoutChunks.join(''));
      expect(screen).toContain('Bash output:');
      expect(screen).toContain('tool output');
      expect(screen).toContain('✓ Bash');
    } finally {
      display.reset();
      statusLine.stop();
      consoleLog.mockRestore();
      vi.useRealTimers();
    }
  });

  it('should restore stdout and stderr on stop', () => {
    // Capture what write functions are set before start
    const preStartStdout = process.stdout.write;
    const preStartStderr = process.stderr.write;

    statusLine.start('test');
    statusLine.stop();

    expect(process.stdout.write).toBe(preStartStdout);
    expect(process.stderr.write).toBe(preStartStderr);
  });

  it('should update message when start is called while active', () => {
    vi.useFakeTimers();
    statusLine.start('first');
    statusLine.start('second');

    stdoutChunks = [];
    vi.advanceTimersByTime(100);
    vi.useRealTimers();

    const rendered = stdoutChunks.filter((c) => c.includes('second'));
    expect(rendered.length).toBeGreaterThan(0);

    statusLine.stop();
  });

  it('should update message via update()', () => {
    vi.useFakeTimers();
    statusLine.start('original');
    statusLine.update('updated');

    stdoutChunks = [];
    vi.advanceTimersByTime(100);
    vi.useRealTimers();

    const rendered = stdoutChunks.filter((c) => c.includes('updated'));
    expect(rendered.length).toBeGreaterThan(0);

    statusLine.stop();
  });

  it('should defer start while suspended and resume with the latest message', () => {
    vi.useFakeTimers();
    statusLine.start('original');
    statusLine.suspend();
    stdoutChunks = [];

    statusLine.start('deferred');
    vi.advanceTimersByTime(100);

    expect(stdoutChunks.some((chunk) => chunk.includes('deferred'))).toBe(false);

    statusLine.resume();
    vi.advanceTimersByTime(100);

    expect(stdoutChunks.some((chunk) => chunk.includes('deferred'))).toBe(true);
  });

  it('should defer update while suspended and resume with the latest message', () => {
    vi.useFakeTimers();
    statusLine.start('original');
    statusLine.suspend();
    stdoutChunks = [];

    statusLine.update('updated');
    vi.advanceTimersByTime(100);

    expect(stdoutChunks.some((chunk) => chunk.includes('updated'))).toBe(false);

    statusLine.resume();
    vi.advanceTimersByTime(100);

    expect(stdoutChunks.some((chunk) => chunk.includes('updated'))).toBe(true);
  });

  it('should defer start after suspending an inactive status line', () => {
    vi.useFakeTimers();
    statusLine.stop();
    statusLine.suspend();
    statusLine.start('deferred');

    vi.advanceTimersByTime(100);

    expect(stdoutChunks.some((chunk) => chunk.includes('deferred'))).toBe(false);

    statusLine.resume();
    vi.advanceTimersByTime(100);

    expect(stdoutChunks.some((chunk) => chunk.includes('deferred'))).toBe(true);
  });

  it('should be safe to call stop multiple times', () => {
    statusLine.start('test');
    statusLine.stop();
    statusLine.stop(); // should not throw
  });

  it('should be safe to call stop without start', () => {
    statusLine.stop(); // should not throw
  });

  it('should resume only after all nested suspensions are released', () => {
    vi.useFakeTimers();
    statusLine.start('Working...');
    statusLine.suspend();
    statusLine.suspend();
    stdoutChunks = [];

    statusLine.resume();
    vi.advanceTimersByTime(100);
    expect(stdoutChunks.some((chunk) => chunk.includes('Working...'))).toBe(false);

    statusLine.resume();
    vi.advanceTimersByTime(100);
    expect(stdoutChunks.some((chunk) => chunk.includes('Working...'))).toBe(true);
  });

  it('should not resume after stop invalidates a suspension', () => {
    vi.useFakeTimers();
    statusLine.start('Working...');
    statusLine.suspend();
    statusLine.stop();
    stdoutChunks = [];

    statusLine.resume();
    vi.advanceTimersByTime(100);

    expect(stdoutChunks.some((chunk) => chunk.includes('Working...'))).toBe(false);
  });
});
