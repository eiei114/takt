import { execFileSync } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createProviderEventLogger } from '../core/logging/providerEventLogger.js';
import {
  callDeepSeekHarness,
  closeDeepSeekHarnessProcesses,
} from '../infra/deepseek-harness/index.js';

function findPython(): string | undefined {
  const candidates = process.platform === 'win32' ? ['python'] : ['python3', 'python'];
  for (const candidate of candidates) {
    try {
      const version = execFileSync(candidate, ['-c', 'import sys; print(sys.version_info[:2])'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const match = /\((\d+), (\d+)\)/u.exec(version);
      if (match !== null && Number(match[1]) >= 3 && Number(match[2]) >= 10) {
        return candidate;
      }
    } catch {
      // Try the next supported interpreter name.
    }
  }
  return undefined;
}

const supportedRuntime = (
  (process.platform === 'linux' && (process.arch === 'x64' || process.arch === 'arm64'))
  || (process.platform === 'darwin' && process.arch === 'arm64')
) && findPython() !== undefined;

it.skipIf(supportedRuntime)('DeepSeek Harness fails fast with an actionable unsupported-platform error', async () => {
  const response = await callDeepSeekHarness('worker', 'hello', { cwd: process.cwd() });

  expect(response.status).toBe('error');
  expect(response.content).toContain('Linux x64/arm64 or macOS arm64');
  expect(response.content).toContain('no provider fallback is available');
});

describe.skipIf(!supportedRuntime)('DeepSeek Harness bridge lifecycle', () => {
  let root: string;
  let pythonPath: string;

  beforeEach(async () => {
    const python = findPython();
    if (python === undefined) {
      throw new Error('Python 3.10+ was detected during suite selection but is unavailable');
    }
    root = await mkdtemp(path.join(os.tmpdir(), 'takt-deepseek-harness-'));
    const moduleDir = path.join(root, 'deepseek_harness');
    await mkdir(moduleDir);
    await writeFile(path.join(moduleDir, '__init__.py'), `
import os
import time

class Notification:
    def __init__(self, method, payload):
        self.method = method
        self.payload = payload

class Result:
    def __init__(self, session_id, final_response, finish_reason):
        self.session_id = session_id
        self.final_response = final_response
        self.finish_reason = finish_reason

class SdkProtocolError(Exception):
    pass

class JsonRpcError(Exception):
    pass

class DeepSeekHarness:
    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.closed = False
        counter_file = kwargs.get('session_root')
        if counter_file:
            with open(counter_file, 'a', encoding='utf-8') as counter:
                counter.write('initialized\\n')

    def start(self):
        if os.path.basename(self.kwargs.get('cordis', '')) == 'FAKE_START_FAILURE':
            raise RuntimeError('startup failure')

    def close(self):
        if os.path.basename(self.kwargs.get('cordis', '')) == 'FAKE_CLOSE_HANG':
            time.sleep(30)
        self.closed = True

    def start_session(self, session_id=None):
        harness = self
        active_session = session_id or 'generated-session'
        class Session:
            id = active_session
            def run(self, input, *, on_notification=None):
                return harness.run(input, session_id=active_session, on_notification=on_notification)
        return Session()

    def run(self, input, *, session_id=None, on_notification=None):
        if input == 'hang':
            time.sleep(30)
        if input == 'fail-secret':
            raise RuntimeError(os.environ.get('DEEPSEEK_API_KEY', 'missing-secret'))
        if input == 'malformed-json':
            print('not-json', flush=True)
        if input == 'jsonrpc-failure':
            raise JsonRpcError('jsonrpc failure')
        if input == 'unexpected-exit':
            os._exit(23)
        active_session = session_id or 'generated-session'
        secret = os.environ.get('DEEPSEEK_API_KEY', '')
        secret_events = input == 'secret-events'
        finish_reason = input.split(':', 1)[1] if input.startswith('reason:') else 'completed'
        text = secret if secret_events else 'hello'
        tool_arguments = '{"path":"' + (secret if secret_events else 'README.md') + '"}'
        events = [
            {'type': 'assistant/chunk', 'data': {'chunk': {'type': 'reasoning-delta', 'text': secret if secret_events else 'thinking'}}},
            {'type': 'tool/call', 'data': {'callId': 'call-1', 'name': 'read', 'arguments': tool_arguments}},
            {'type': 'tool/result', 'data': {'message': {'source': {'callId': 'call-1'}, 'content': [{'type': 'tool-result', 'toolCallId': 'call-1', 'content': [{'type': 'text', 'text': secret if secret_events else 'file'}]}]}}},
            {'type': 'assistant/chunk', 'data': {'chunk': {'type': 'text-delta', 'text': text}}},
            {'type': 'turn/end', 'data': {'reason': {'kind': finish_reason, **({'error': {'code': 'FAKE', 'message': 'provider failure'}} if finish_reason == 'error' else {})}}},
        ]
        if input == 'message-events':
            events = [
                {'type': 'assistant/message', 'data': {'message': {'content': [{'type': 'text', 'text': 'first'}]}}},
                {'type': 'assistant/message', 'data': {'message': {'content': [{'type': 'text', 'text': 'second'}]}}},
                {'type': 'turn/end', 'data': {'reason': {'kind': 'completed'}}},
            ]
        if on_notification is not None:
            for event in events:
                on_notification(Notification('session.event', {'sessionId': active_session, 'event': event}))
        final_response = 'firstsecond' if input == 'message-events' else (secret if secret_events else 'hello')
        return Result(active_session, final_response, finish_reason)
`, 'utf8');
    pythonPath = path.join(root, 'python-wrapper.sh');
    await writeFile(pythonPath, `#!/bin/sh\nPYTHONPATH="${root}:${'${PYTHONPATH:-}'}" exec "${python}" "$@"\n`, 'utf8');
    await chmod(pythonPath, 0o755);
  });

  afterEach(async () => {
    await closeDeepSeekHarnessProcesses();
    await rm(root, { recursive: true, force: true });
  });

  it('converts official SDK notifications and closes one-shot sessions', async () => {
    const events: Array<{ type: string; data: Record<string, unknown> }> = [];
    const response = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      providerOptions: {
        pythonPath,
        requestTimeoutMs: 10_000,
      },
      onStream: (event) => events.push(event as { type: string; data: Record<string, unknown> }),
    });

    expect(response).toMatchObject({ status: 'done', content: 'hello', sessionId: 'generated-session' });
    expect(events).toEqual(expect.arrayContaining([
      { type: 'thinking', data: { thinking: 'thinking' } },
      { type: 'tool_use', data: { id: 'call-1', tool: 'read', input: { path: 'README.md' } } },
      { type: 'tool_result', data: { id: 'call-1', content: 'file', isError: false } },
      { type: 'text', data: { text: 'hello' } },
      expect.objectContaining({ type: 'result', data: expect.objectContaining({ success: true }) }),
    ]));
  });

  it('preserves multiple assistant messages when the SDK omits chunk events', async () => {
    const textEvents: string[] = [];
    const response = await callDeepSeekHarness('worker', 'message-events', {
      cwd: root,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
      onStream: (event) => {
        if (event.type === 'text') {
          textEvents.push(event.data.text);
        }
      },
    });

    expect(response).toMatchObject({ status: 'done', content: 'firstsecond' });
    expect(textEvents).toEqual(['first', 'second']);
  });

  it('redacts a DeepSeek API key from bridge failures', async () => {
    const secret = 'deepseek-test-secret-123';
    const response = await callDeepSeekHarness('worker', 'fail-secret', {
      cwd: root,
      childProcessEnv: { DEEPSEEK_API_KEY: secret },
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });

    expect(response.status).toBe('error');
    expect(response.content).not.toContain(secret);
    expect(response.content).toContain('[REDACTED]');
  });

  it('redacts credentials from text, thinking, tool payloads, final output, and provider event logs', async () => {
    const secret = 'deepseek-output-secret-456';
    const logsDir = path.join(root, 'logs');
    await mkdir(logsDir);
    const logger = createProviderEventLogger({
      logsDir,
      sessionId: 'deepseek-output-session',
      runId: 'deepseek-output-run',
      enabled: true,
    });
    const events: Array<{ type: string; data: Record<string, unknown> }> = [];
    const response = await callDeepSeekHarness('worker', 'secret-events', {
      cwd: root,
      childProcessEnv: { DEEPSEEK_API_KEY: secret },
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
      onStream: (event) => {
        events.push(event as { type: string; data: Record<string, unknown> });
        logger.logEvent({
          provider: 'deepseek-harness',
          providerModel: 'deepseek-v4-flash',
          step: 'smoke',
        }, event);
      },
    });
    const persisted = await readFile(logger.filepath, 'utf8');

    expect(response).toMatchObject({ status: 'done', content: '[REDACTED]' });
    expect(JSON.stringify(events)).not.toContain(secret);
    expect(JSON.stringify(events)).toContain('[REDACTED]');
    expect(persisted).not.toContain(secret);
    expect(persisted).toContain('[REDACTED]');
  });

  it.each([
    ['blocked', 'blocked', 'blocked'],
    ['max-tokens', 'error', 'maximum token limit'],
    ['interrupted', 'error', 'interrupted'],
    ['error', 'error', 'provider failure'],
  ] as const)('maps the official %s finish reason without reporting success', async (reason, status, message) => {
    const response = await callDeepSeekHarness('worker', `reason:${reason}`, {
      cwd: root,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });

    expect(response.status).toBe(status);
    expect(response.content).toContain(message);
    expect(response.status).not.toBe('done');
  });

  it('rejects an unknown finish reason as a provider stream protocol error', async () => {
    const response = await callDeepSeekHarness('worker', 'reason:future-reason', {
      cwd: root,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });

    expect(response.status).toBe('error');
    expect(response.failureCategory).toBe('provider_stream_parse_error');
    expect(response.content).toContain('unsupported turn completion reason');
  });

  it('returns a provider error when SDK startup fails', async () => {
    const response = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      providerOptions: {
        pythonPath,
        cordis: 'FAKE_START_FAILURE',
        requestTimeoutMs: 10_000,
      },
    });

    expect(response.status).toBe('error');
    expect(response.failureCategory).toBe('provider_error');
    expect(response.content).toContain('startup failure');
  });

  it('maps malformed bridge output to a stream protocol error', async () => {
    const response = await callDeepSeekHarness('worker', 'malformed-json', {
      cwd: root,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });

    expect(response.status).toBe('error');
    expect(response.failureCategory).toBe('provider_stream_parse_error');
    expect(response.content).toContain('malformed JSON');
  });

  it('maps an SDK JSON-RPC failure to a provider error', async () => {
    const response = await callDeepSeekHarness('worker', 'jsonrpc-failure', {
      cwd: root,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });

    expect(response.status).toBe('error');
    expect(response.failureCategory).toBe('provider_error');
    expect(response.content).toContain('jsonrpc failure');
  });

  it('maps an unexpected bridge exit to a provider error without hanging', async () => {
    const response = await callDeepSeekHarness('worker', 'unexpected-exit', {
      cwd: root,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });

    expect(response.status).toBe('error');
    expect(response.failureCategory).toBe('provider_error');
    expect(response.content).toMatch(/process exited|stdout closed/u);
  });

  it('reuses one Python bridge for repeated calls with the same session', async () => {
    const counterFile = path.join(root, 'bridge-starts.txt');
    const first = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      sessionId: 'persistent-session',
      providerOptions: { pythonPath, sessionRoot: counterFile, requestTimeoutMs: 10_000 },
    });
    const second = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      sessionId: 'persistent-session',
      providerOptions: { pythonPath, sessionRoot: counterFile, requestTimeoutMs: 10_000 },
    });

    expect(first).toMatchObject({ status: 'done', sessionId: 'persistent-session' });
    expect(second).toMatchObject({ status: 'done', sessionId: 'persistent-session' });
    expect((await readFile(counterFile, 'utf8')).trim().split('\n')).toEqual(['initialized']);
  });

  it('maps a request timeout to a bounded part-timeout failure and closes the bridge', async () => {
    const startedAt = Date.now();
    const response = await callDeepSeekHarness('worker', 'hang', {
      cwd: root,
      providerOptions: {
        pythonPath,
        requestTimeoutMs: 100,
      },
    });

    expect(response.status).toBe('error');
    expect(response.failureCategory).toBe('part_timeout');
    expect(response.content).toContain('timed out');
    expect(Date.now() - startedAt).toBeLessThan(5_000);
  });

  it('terminates a bridge that does not answer the close request', async () => {
    const startedAt = Date.now();
    const response = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      providerOptions: {
        pythonPath,
        cordis: 'FAKE_CLOSE_HANG',
        requestTimeoutMs: 10_000,
        shutdownTimeoutMs: 100,
      },
    });

    expect(response.status).toBe('done');
    expect(Date.now() - startedAt).toBeLessThan(5_000);
  });

  it('terminates the Python bridge when the caller aborts a running SDK turn', async () => {
    const controller = new AbortController();
    const startedAt = Date.now();
    const call = callDeepSeekHarness('worker', 'hang', {
      cwd: root,
      abortSignal: controller.signal,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });
    setTimeout(() => controller.abort(new Error('cancelled by test')), 100).unref();

    const response = await call;
    expect(response.status).toBe('error');
    expect(response.failureCategory).toBe('external_abort');
    expect(Date.now() - startedAt).toBeLessThan(10_000);
  });
});
