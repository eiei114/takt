/**
 * Persistent status line spinner.
 *
 * Shows an animated spinner on the last line of the terminal.
 * Regular output scrolls above it. Intercepts both stdout and stderr
 * writes to clear and redraw the spinner around each write.
 */

import chalk from 'chalk';
import { fstatSync } from 'node:fs';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

type RawWrite = (str: string) => boolean;

/** Compare device metadata to decide whether two TTY streams share a destination. */
function sharesOutputTerminal(stdoutFd: number, stderrFd: number): boolean {
  // isTTY only identifies terminal streams; device metadata distinguishes their destinations.
  const stdoutStats = fstatSync(stdoutFd);
  const stderrStats = fstatSync(stderrFd);
  return stdoutStats.dev === stderrStats.dev
    && stdoutStats.ino === stderrStats.ino
    && stdoutStats.rdev === stderrStats.rdev;
}

class StatusLineImpl {
  private active = false;
  private message = '';
  private frame = 0;
  private intervalId?: ReturnType<typeof setInterval>;
  private rawStdoutWrite?: RawWrite;
  private savedStdoutWrite?: typeof process.stdout.write;
  private savedStderrWrite?: typeof process.stderr.write;
  private rendering = false;
  private spinnerRendered = false;
  private outputLineOpen = false;
  private suspendedMessage?: string;
  private suspendDepth = 0;

  /** Start the TTY spinner, deferring redraws while streamed text has no final newline. */
  start(message: string): void {
    if (this.suspendDepth > 0) {
      this.suspendedMessage = message;
      return;
    }
    if (this.active) {
      this.message = message;
      return;
    }
    if (!process.stdout.isTTY) return;

    const stderrSharesOutputTerminal = process.stderr.isTTY === true
      && sharesOutputTerminal(process.stdout.fd, process.stderr.fd);

    this.active = true;
    this.message = message;
    this.frame = 0;
    this.outputLineOpen = false;

    this.savedStdoutWrite = process.stdout.write;
    this.savedStderrWrite = process.stderr.write;
    this.rawStdoutWrite = process.stdout.write.bind(process.stdout) as RawWrite;
    const rawStderrWrite = process.stderr.write.bind(process.stderr) as RawWrite;
    const raw = this.rawStdoutWrite;

    /** Wrap a stream writer, tracking partial lines only on the spinner's terminal. */
    const wrapWrite = (origRaw: RawWrite, sharesOutputTerminal: boolean) =>
      /** Clear only an existing spinner before forwarding output and updating line state. */
      (chunk: unknown): boolean => {
        const output = String(chunk);
        if (this.rendering) return origRaw(output);
        if (sharesOutputTerminal) this.clearSpinner();
        const result = origRaw(output);
        if (!sharesOutputTerminal) return result;
        if (output.includes('\n')) {
          const lastNewline = output.lastIndexOf('\n');
          this.outputLineOpen = lastNewline !== output.length - 1;
          this.render();
        } else if (output.length > 0) {
          this.outputLineOpen = true;
        }
        return result;
      };

    process.stdout.write = wrapWrite(raw, true);
    process.stderr.write = wrapWrite(rawStderrWrite, stderrSharesOutputTerminal);

    this.intervalId = setInterval(() => this.render(), 80);
  }

  /** Update the active or deferred spinner message. */
  update(message: string): void {
    if (this.suspendDepth > 0) {
      this.suspendedMessage = message;
      return;
    }
    this.message = message;
  }

  /** Pause the spinner and finish partial output so prompts can safely start a new line. */
  suspend(): void {
    if (this.suspendDepth > 0) {
      this.suspendDepth++;
      return;
    }
    if (!this.active) {
      this.suspendDepth = 1;
      return;
    }

    const message = this.message;
    if (this.outputLineOpen) {
      this.rawStdoutWrite?.('\n');
      this.outputLineOpen = false;
    }
    this.stop();
    this.suspendedMessage = message;
    this.suspendDepth = 1;
  }

  /** Restart the deferred spinner after the outermost suspension ends. */
  resume(): void {
    if (this.suspendDepth === 0) return;
    this.suspendDepth--;
    if (this.suspendDepth > 0) return;

    if (this.suspendedMessage === undefined) return;
    const message = this.suspendedMessage;
    this.suspendedMessage = undefined;
    this.start(message);
  }

  /** Clear a rendered spinner, restore stream writers, and cancel any deferred restart. */
  stop(): void {
    this.suspendDepth = 0;
    this.suspendedMessage = undefined;
    if (!this.active) return;
    this.active = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.clearSpinner();
    if (this.savedStdoutWrite) {
      process.stdout.write = this.savedStdoutWrite;
      this.savedStdoutWrite = undefined;
    }
    if (this.savedStderrWrite) {
      process.stderr.write = this.savedStderrWrite;
      this.savedStderrWrite = undefined;
    }
    this.rawStdoutWrite = undefined;
  }

  /** Draw a spinner frame only when it cannot overwrite an unfinished output line. */
  private render(): void {
    if (!this.rawStdoutWrite || !this.active || this.outputLineOpen) return;
    this.rendering = true;
    const f = FRAMES[this.frame++ % FRAMES.length];
    this.rawStdoutWrite(`\r${chalk.cyan(f)} ${this.message}`);
    this.rendering = false;
    this.spinnerRendered = true;
  }

  /** Erase the current line only if it contains a spinner drawn by this instance. */
  private clearSpinner(): void {
    if (!this.rawStdoutWrite || !this.spinnerRendered) return;
    this.rawStdoutWrite('\r\x1b[K');
    this.spinnerRendered = false;
  }
}

export const statusLine = new StatusLineImpl();
