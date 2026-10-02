import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeBehavior = vi.hoisted(() => ({
  runError: undefined as unknown,
  closeError: undefined as unknown,
  notifications: [] as unknown[],
  startCount: 0,
  runCount: 0,
}));
const runtimeStateBehavior = vi.hoisted(() => ({ blockCreationAtStart: false }));

vi.mock('@deepseek-ai/dsh-sdk-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deepseek-ai/dsh-sdk-client')>();
  return {
    ...actual,
    DeepSeekHarness: class {
      constructor(_options: unknown) {}

      async start(): Promise<void> {
        runtimeBehavior.startCount += 1;
      }

      async run(
        _prompt: string,
        options?: { onNotification?: (notification: unknown) => void },
      ): Promise<{ sessionId: string; finalResponse: string; finishReason: 'completed' }> {
        runtimeBehavior.runCount += 1;
        if (runtimeBehavior.runError !== undefined) {
          throw runtimeBehavior.runError;
        }
        for (const notification of runtimeBehavior.notifications) {
          options?.onNotification?.(notification);
        }
        return { sessionId: 'error-mapping-session', finalResponse: 'ok', finishReason: 'completed' };
      }

      async close(): Promise<void> {
        if (runtimeBehavior.closeError !== undefined) {
          throw runtimeBehavior.closeError;
        }
      }
    },
  };
});

vi.mock('../infra/deepseek-harness/runtime-state.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../infra/deepseek-harness/runtime-state.js')>();
  return {
    ...actual,
    withDeepSeekRuntimeCreation: <T,>(
      create: () => Promise<T>,
      cleanupAfterFailure?: () => Promise<boolean>,
    ): Promise<T> => {
      if (runtimeStateBehavior.blockCreationAtStart) {
        return Promise.reject(new actual.DeepSeekRuntimeCreationBlockedError());
      }
      return actual.withDeepSeekRuntimeCreation(create, cleanupAfterFailure);
    },
  };
});

import {
  JsonRpcResponseError,
  RequestTimeoutError,
  SdkProtocolError,
  TransportClosedError,
} from '@deepseek-ai/dsh-sdk-client';
import { callDeepSeekHarness, closeDeepSeekHarnessProcesses } from '../infra/deepseek-harness/index.js';
import {
  DeepSeekRuntimeCreationBlockedError,
  getDeepSeekRuntimePaths,
  withDeepSeekRuntimeCreation,
} from '../infra/deepseek-harness/runtime-state.js';
import { AGENT_FAILURE_CATEGORIES } from '../shared/types/agent-failure.js';
import type { StreamEvent } from '../shared/types/provider.js';

const environmentKeys = ['TAKT_CONFIG_DIR', 'DSH_HOME', 'DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL', 'TMPDIR'] as const;
const savedEnvironment = new Map<string, string | undefined>();
const RAW_FAILURE_SENTINEL = 'TAKT_RAW_SDK_FAILURE_SENTINEL';
let temporaryRoot: string;

describe('DeepSeek Harness SDK error mapping', () => {
  beforeEach(async () => {
    for (const key of environmentKeys) savedEnvironment.set(key, process.env[key]);
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'takt-deepseek-error-mapping-'));
    process.env.TMPDIR = path.join(temporaryRoot, 'tmp');
    await mkdir(process.env.TMPDIR, { recursive: true });
    process.env.TAKT_CONFIG_DIR = path.join(temporaryRoot, 'takt-config');
    process.env.DSH_HOME = path.join(temporaryRoot, 'credential-source');
    process.env.DEEPSEEK_API_KEY = 'TAKT_DUMMY_ERROR_MAPPING_CREDENTIAL';
    delete process.env.DEEPSEEK_BASE_URL;
    await mkdir(process.env.DSH_HOME, { recursive: true });
    runtimeBehavior.runError = undefined;
    runtimeBehavior.closeError = undefined;
    runtimeStateBehavior.blockCreationAtStart = false;
    runtimeBehavior.notifications = [];
    runtimeBehavior.startCount = 0;
    runtimeBehavior.runCount = 0;
  });

  afterEach(async () => {
    await closeDeepSeekHarnessProcesses().catch(() => undefined);
    await rm(temporaryRoot, { recursive: true, force: true });
    for (const key of environmentKeys) {
      const value = savedEnvironment.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    savedEnvironment.clear();
  });

  it.each([
    [
      'JSON-RPC errors',
      new JsonRpcResponseError(-32000, `raw ${RAW_FAILURE_SENTINEL}`, { detail: RAW_FAILURE_SENTINEL }),
      AGENT_FAILURE_CATEGORIES.PROVIDER_ERROR,
      'DeepSeek Harness runtime returned a JSON-RPC error. Upstream error details are withheld.',
    ],
    [
      'SDK protocol errors',
      new SdkProtocolError(`raw ${RAW_FAILURE_SENTINEL}`),
      AGENT_FAILURE_CATEGORIES.PROVIDER_STREAM_PARSE_ERROR,
      'provider stream parse error: DeepSeek Harness SDK protocol validation failed',
    ],
    [
      'transport closure errors',
      new TransportClosedError(`runtime closed; stderr ${RAW_FAILURE_SENTINEL}`),
      AGENT_FAILURE_CATEGORIES.PROVIDER_ERROR,
      'DeepSeek Harness runtime connection closed. Verify the runtime installation and retry. Upstream error details are withheld.',
    ],
    [
      'request timeout errors',
      new RequestTimeoutError(`request timed out; stderr ${RAW_FAILURE_SENTINEL}`),
      AGENT_FAILURE_CATEGORIES.PART_TIMEOUT,
      'part timeout: DeepSeek Harness SDK request timed out; the runtime was closed.',
    ],
  ] as const)('returns a fixed diagnostic for %s without exposing raw SDK data', async (_label, sdkError, category, expected) => {
    runtimeBehavior.runError = sdkError;
    const events: StreamEvent[] = [];
    const response = await callDeepSeekHarness('worker', 'trigger an SDK failure', {
      cwd: temporaryRoot,
      onStream: (event) => events.push(event),
    });

    expect(response).toMatchObject({ status: 'error', failureCategory: category, content: expected, error: expected });
    expect(events.at(-1)).toMatchObject({
      type: 'result',
      data: { success: false, error: expected, result: expected, failureCategory: category },
    });
    expect(JSON.stringify({ response, events })).not.toContain(RAW_FAILURE_SENTINEL);
  });

  it('classifies the SDK duplicate-session response as unsupported continuation', async () => {
    const sessionId = 'saved-session-duplicate';
    runtimeBehavior.runError = new JsonRpcResponseError(-32603, `session "${sessionId}" already exists`);
    const response = await callDeepSeekHarness('worker', 'continue saved session', {
      cwd: temporaryRoot,
      sessionId,
    });

    expect(response).toMatchObject({
      status: 'error',
      sessionId,
      failureCategory: AGENT_FAILURE_CATEGORIES.SESSION_CONTINUATION_UNSUPPORTED,
      content: 'DeepSeek Harness cannot continue this session after runtime replacement or teardown; start a new TAKT session or run.',
    });
    expect(response.sessionId).toBe(sessionId);
    expect(response.content).not.toContain(sessionId);
  });

  it('does not classify a different SDK JSON-RPC error as duplicate session', async () => {
    runtimeBehavior.runError = new JsonRpcResponseError(-32603, 'invalid request');
    const response = await callDeepSeekHarness('worker', 'send an invalid request', {
      cwd: temporaryRoot,
      sessionId: 'saved-session-invalid-request',
    });

    expect(response).toMatchObject({
      status: 'error',
      failureCategory: AGENT_FAILURE_CATEGORIES.PROVIDER_ERROR,
      content: 'DeepSeek Harness runtime returned a JSON-RPC error. Upstream error details are withheld.',
    });
    expect(response.content).not.toContain('invalid request');
  });

  it('maps SDK assistant/message text, reasoning, tool, and completion notifications to provider stream events', async () => {
    const sessionId = 'error-mapping-session';
    const event = (value: Record<string, unknown>) => ({
      method: 'session.event',
      params: { sessionId, event: value },
    });
    runtimeBehavior.notifications = [
      { method: 'session.started', params: { sessionId } },
      event({
        type: 'assistant/message',
        data: {
          message: {
            content: [
              { type: 'text', text: 'answer' },
              { type: 'reasoning', text: 'reasoning' },
              { type: 'tool-call', id: 'tool-call-1', name: 'Read', arguments: '{"file":"README.md"}' },
              {
                type: 'tool-result',
                toolCallId: 'tool-call-1',
                content: [{ type: 'text', text: 'README content' }],
                isError: false,
              },
            ],
          },
        },
      }),
      event({
        type: 'tool/call',
        data: { callId: 'tool-call-1', name: 'Read', arguments: '{"file":"README.md"}' },
      }),
      event({
        type: 'tool/result',
        data: {
          message: {
            source: { callId: 'tool-call-1' },
            content: [{
              type: 'tool-result',
              content: [{ type: 'text', text: 'README content' }],
              isError: false,
            }],
          },
        },
      }),
      event({ type: 'turn/end', data: { reason: { kind: 'completed' } } }),
    ];
    const events: StreamEvent[] = [];

    const response = await callDeepSeekHarness('worker', 'map SDK events', {
      cwd: temporaryRoot,
      sessionId,
      onStream: (streamEvent) => events.push(streamEvent),
    });

    expect(response).toMatchObject({ status: 'done', content: 'ok', sessionId });
    expect(events.map((streamEvent) => streamEvent.type)).toEqual([
      'init',
      'text',
      'thinking',
      'tool_use',
      'tool_result',
      'result',
    ]);
    expect(events[1]?.data).toEqual({ text: 'answer' });
    expect(events[2]?.data).toEqual({ thinking: 'reasoning' });
    expect(events[3]?.data).toEqual({
      id: 'tool-call-1',
      tool: 'Read',
      input: { file: 'README.md' },
    });
    expect(events[4]?.data).toEqual({
      id: 'tool-call-1',
      content: 'README content',
      isError: false,
    });
  });

  it('reports cleanup failure with a fixed diagnostic and prevents later runtime creation', async () => {
    runtimeBehavior.runError = new JsonRpcResponseError(-32000, 'original failure');
    runtimeBehavior.closeError = new Error(`cleanup ${RAW_FAILURE_SENTINEL}`);
    const events: StreamEvent[] = [];
    const response = await callDeepSeekHarness('worker', 'trigger cleanup failure', {
      cwd: temporaryRoot,
      onStream: (event) => events.push(event),
    });

    const expected = 'DeepSeek Harness runtime cleanup is unconfirmed; no new runtime can start until the previous runtime exits.';
    expect(response).toMatchObject({
      status: 'error',
      failureCategory: AGENT_FAILURE_CATEGORIES.PROVIDER_ERROR,
      content: expected,
      error: expected,
    });
    expect(runtimeBehavior.startCount).toBe(1);
    expect(runtimeBehavior.runCount).toBe(1);
    expect(JSON.stringify({ response, events })).not.toContain(RAW_FAILURE_SENTINEL);
    await expect(callDeepSeekHarness('worker', 'must not overlap the uncleared runtime', {
      cwd: temporaryRoot,
    })).resolves.toMatchObject({
      status: 'error',
      failureCategory: AGENT_FAILURE_CATEGORIES.PROVIDER_ERROR,
      content: expected,
    });
    expect(runtimeBehavior.startCount).toBe(1);
    expect(runtimeBehavior.runCount).toBe(1);
  });

  it('fails closed with a fixed diagnostic when shared runtime state cannot be read', async () => {
    const paths = getDeepSeekRuntimePaths();
    await mkdir(paths.state, { recursive: true });
    await writeFile(path.join(paths.state, 'cleanup-blocked'), '{invalid');
    let createCalled = false;

    await expect(withDeepSeekRuntimeCreation(async () => {
      createCalled = true;
    })).rejects.toBeInstanceOf(DeepSeekRuntimeCreationBlockedError);
    expect(createCalled).toBe(false);

    const response = await callDeepSeekHarness('worker', 'must fail before runtime creation', {
      cwd: temporaryRoot,
    });
    const expected = 'DeepSeek Harness runtime cleanup is unconfirmed; no new runtime can start until the previous runtime exits.';
    expect(response).toMatchObject({
      status: 'error',
      failureCategory: AGENT_FAILURE_CATEGORIES.PROVIDER_ERROR,
      content: expected,
      error: expected,
    });
    expect(runtimeBehavior.startCount).toBe(0);
    expect(runtimeBehavior.runCount).toBe(0);
  });

  it('fails closed when another process keeps the shared runtime state lock', async () => {
    const paths = getDeepSeekRuntimePaths();
    const lockDirectory = path.join(paths.state, '.runtime-state-lock');
    await mkdir(lockDirectory, { recursive: true });
    await writeFile(path.join(lockDirectory, 'owner'), `${process.pid}\n`);

    try {
      const response = await callDeepSeekHarness('worker', 'must not start without the shared lock', {
        cwd: temporaryRoot,
      });
      const expected = 'DeepSeek Harness runtime cleanup is unconfirmed; no new runtime can start until the previous runtime exits.';
      expect(response).toMatchObject({
        status: 'error',
        failureCategory: AGENT_FAILURE_CATEGORIES.PROVIDER_ERROR,
        content: expected,
        error: expected,
      });
      expect(runtimeBehavior.startCount).toBe(0);
      expect(runtimeBehavior.runCount).toBe(0);
    } finally {
      await rm(lockDirectory, { recursive: true, force: true });
    }
  }, 20_000);

  it('preserves the cleanup diagnostic when the runtime start gate fails after provider setup', async () => {
    runtimeStateBehavior.blockCreationAtStart = true;

    const response = await callDeepSeekHarness('worker', 'fail at the runtime start gate', {
      cwd: temporaryRoot,
    });

    const expected = 'DeepSeek Harness runtime cleanup is unconfirmed; no new runtime can start until the previous runtime exits.';
    expect(response).toMatchObject({
      status: 'error',
      failureCategory: AGENT_FAILURE_CATEGORIES.PROVIDER_ERROR,
      content: expected,
      error: expected,
    });
    expect(runtimeBehavior.startCount).toBe(0);
    expect(runtimeBehavior.runCount).toBe(0);
  });
});
