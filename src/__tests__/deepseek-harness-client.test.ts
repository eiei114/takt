import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProviderEventLogger } from '../core/logging/providerEventLogger.js';
import {
  callDeepSeekHarness,
  closeDeepSeekHarnessProcesses,
} from '../infra/deepseek-harness/index.js';

function isSupportedPythonVersion(version: readonly [number, number]): boolean {
  const minimum: readonly [number, number] = [3, 10];
  return version[0] > minimum[0]
    || (version[0] === minimum[0] && version[1] >= minimum[1]);
}

function findPython(candidates: readonly string[]): string | undefined {
  for (const candidate of candidates) {
    try {
      const details = execFileSync(candidate, [
        '-c',
        'import os, sys; print(sys.version_info[:2]); print(os.path.realpath(sys.executable))',
      ], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const [version, executable] = details.trim().split(/\r?\n/u);
      const match = /\((\d+), (\d+)\)/u.exec(version ?? '');
      const parsedVersion: readonly [number, number] | undefined = match === null
        ? undefined
        : [Number(match[1]), Number(match[2])];
      if (
        parsedVersion !== undefined
        && isSupportedPythonVersion(parsedVersion)
        && executable !== undefined
        && path.isAbsolute(executable)
      ) {
        return executable;
      }
    } catch {
      // Try the next supported interpreter name.
    }
  }
  return undefined;
}

function findLifecyclePython(): string | undefined {
  const candidates = process.platform === 'win32' ? ['python'] : ['python3', 'python'];
  return findPython(candidates);
}

const supportedPlatform = (
  (process.platform === 'linux' && (process.arch === 'x64' || process.arch === 'arm64'))
  || (process.platform === 'darwin' && process.arch === 'arm64')
);
const defaultRuntimeSupported = supportedPlatform && findPython(['python3']) !== undefined;
const lifecycleRuntimeSupported = supportedPlatform && findLifecyclePython() !== undefined;

type TestDeepSeekProviderOptions = NonNullable<Parameters<typeof callDeepSeekHarness>[2]['providerOptions']>;

function asTestDeepSeekProviderOptions(value: unknown): TestDeepSeekProviderOptions {
  return value as TestDeepSeekProviderOptions;
}

async function waitForFile(filePath: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!existsSync(filePath)) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${filePath}`);
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

it.skipIf(supportedPlatform)('DeepSeek Harness fails fast with an actionable unsupported-platform error', async () => {
  const response = await callDeepSeekHarness('worker', 'hello', { cwd: process.cwd() });

  expect(response.status).toBe('error');
  expect(response.content).toContain('Linux x64/arm64 or macOS arm64');
  expect(response.content).toContain('no provider fallback is available');
});

it.skipIf(!supportedPlatform || defaultRuntimeSupported)('DeepSeek Harness fails fast with an actionable missing-Python error on a supported platform', async () => {
  const response = await callDeepSeekHarness('worker', 'hello', { cwd: process.cwd() });

  expect(response.status).toBe('error');
  expect(response.content).toContain('Python 3.10');
});

describe.skipIf(!lifecycleRuntimeSupported)('DeepSeek Harness bridge lifecycle', () => {
  let root: string;
  let pythonPath: string;
  let bridgeInputPath: string;
  let bridgeProxyPath: string;

  beforeEach(async () => {
    const python = findLifecyclePython();
    if (python === undefined) {
      throw new Error('Python 3.10+ was detected during suite selection but is unavailable');
    }
    root = await mkdtemp(path.join(os.tmpdir(), 'takt-deepseek-harness-'));
    bridgeInputPath = path.join(root, 'bridge-input.jsonl');
    bridgeProxyPath = path.join(root, 'bridge-proxy.py');
    const moduleDir = path.join(root, 'deepseek_harness');
    await mkdir(moduleDir);
    for (const [directory, name] of [
      ['deepseek_harness_sdk-0.1.2a3.dist-info', 'deepseek-harness-sdk'],
      ['deepseek_harness_runtime_bin-0.1.2a3.dist-info', 'deepseek-harness-runtime-bin'],
    ] as const) {
      const distInfoDir = path.join(root, directory);
      await mkdir(distInfoDir);
      await writeFile(
        path.join(distInfoDir, 'METADATA'),
        `Metadata-Version: 2.1\nName: ${name}\nVersion: 0.1.2a3\n`,
        'utf8',
      );
    }
    await writeFile(path.join(moduleDir, '__init__.py'), `
import json
import os
import threading
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

class DeepSeekHarnessConfig:
    __dataclass_fields__ = ({
        'session_root': None,
    } if os.path.exists(os.path.join(os.getcwd(), 'FAKE_OLD_SDK')) else {
        'dsh_home': None,
        'profile': None,
        'patches': None,
        'reasoning_effort': None,
    })

class DeepSeekHarness:
    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.closed = False
        config_file = os.path.join(kwargs['cwd'], 'bridge-start-configs.jsonl')
        with open(config_file, 'a', encoding='utf-8') as config:
            config.write(json.dumps(kwargs, sort_keys=True) + '\\n')
        effort = kwargs.get('reasoning_effort', 'unset')
        lifecycle_file = os.path.join(kwargs['cwd'], 'bridge-lifecycle.jsonl')
        with open(lifecycle_file, 'a', encoding='utf-8') as lifecycle:
            lifecycle.write(json.dumps({'event': 'start', 'effort': effort}, sort_keys=True) + '\\n')
        if kwargs.get('provider') == 'unknown-route':
            raise RuntimeError('SDK rejected unknown provider route "unknown-route"')
        if kwargs.get('model') == 'unknown-model':
            raise RuntimeError('SDK rejected unknown model "unknown-model"')
        if kwargs.get('provider') == 'not-found-route':
            raise RuntimeError('SDK provider route not found "not-found-route"')
        if kwargs.get('model') == 'enoent-model':
            raise RuntimeError('ENOENT: SDK model not found "enoent-model"')
        if kwargs.get('model') == 'runtime-unavailable-model':
            raise FileNotFoundError('missing DeepSeek Harness runtime wheel')
        if kwargs.get('model') == 'terminal-diagnostic-model':
            raise RuntimeError('SDK diagnostic \\x1b]52;clipboard\\x07\\x1b[31mraw\\x1b[0m\\x01')
        counter_file = kwargs.get('dsh_home')
        if counter_file:
            os.makedirs(os.path.dirname(counter_file), exist_ok=True)
            with open(counter_file, 'a', encoding='utf-8') as counter:
                counter.write('initialized\\n')
        if self.patch_marker() == 'FAKE_CAPTURE_KWARGS':
            with open(os.path.join(self.kwargs['cwd'], 'sdk-kwargs.json'), 'w', encoding='utf-8') as config:
                json.dump(self.kwargs, config)

    def patch_marker(self):
        patches = self.kwargs.get('patches', ())
        return os.path.basename(patches[0]) if patches else ''

    def start(self):
        if self.patch_marker() == 'FAKE_START_FAILURE':
            raise RuntimeError('startup failure')

    def close(self):
        if self.patch_marker() == 'FAKE_CLOSE_HANG':
            time.sleep(30)
        if self.patch_marker() == 'FAKE_CLOSE_BARRIER':
            patch_path = self.kwargs['patches'][0]
            entered_path = patch_path + '.entered'
            release_path = patch_path + '.release'
            try:
                with open(entered_path, 'x', encoding='utf-8'):
                    pass
            except FileExistsError:
                pass
            while not os.path.exists(release_path):
                time.sleep(0.01)
        effort = self.kwargs.get('reasoning_effort', 'unset')
        with open(os.path.join(self.kwargs['cwd'], 'bridge-lifecycle.jsonl'), 'a', encoding='utf-8') as lifecycle:
            lifecycle.write(json.dumps({'event': 'close', 'effort': effort}, sort_keys=True) + '\\n')
        if self.patch_marker() == 'FAKE_CLOSE_FAILURE':
            raise RuntimeError('close failure')
        self.closed = True

    def start_session(self, session_id=None):
        harness = self
        active_session = session_id or 'generated-session'
        class Session:
            id = active_session
            def run(self, input, *, on_notification=None):
                return harness.run(input, session_id=active_session, on_notification=on_notification)
        return Session()

    def session_history_path(self):
        dsh_home = self.kwargs.get('dsh_home')
        if dsh_home:
            os.makedirs(os.path.dirname(dsh_home), exist_ok=True)
            return dsh_home + '.history.jsonl'
        return os.path.join(self.kwargs['cwd'], 'sdk-session-history-state.jsonl')

    def read_session_history(self, session_id):
        history_path = self.session_history_path()
        if not os.path.exists(history_path):
            return []
        records = []
        with open(history_path, 'r', encoding='utf-8') as history:
            for line in history:
                record = json.loads(line)
                if record.get('sessionId') == session_id:
                    records.append(record)
        return records

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
        previous_history = self.read_session_history(active_session)
        history_record = {
            'effort': self.kwargs.get('reasoning_effort', 'unset'),
            'input': input,
            'sessionId': active_session,
        }
        with open(self.session_history_path(), 'a', encoding='utf-8') as session_history:
            session_history.write(json.dumps(history_record, sort_keys=True) + '\\n')
        with open(os.path.join(self.kwargs['cwd'], 'sdk-session-history.jsonl'), 'a', encoding='utf-8') as history:
            history.write(json.dumps(history_record, sort_keys=True) + '\\n')
        if input.startswith('capture-prompt:'):
            with open(os.path.join(self.kwargs['cwd'], 'received-prompt.txt'), 'w', encoding='utf-8') as prompt_file:
                prompt_file.write(input)
        if input == 'inspect-env':
            environment = {}
            for name in ['DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL', 'OPENAI_API_KEY', 'TAKT_OBSERVABILITY_ENABLED', 'HOME', 'DSH_RUNTIME_MODE']:
                value = os.environ.get(name)
                if value is not None:
                    environment[name] = value
            with open(os.path.join(self.kwargs['cwd'], 'bridge-env.json'), 'w', encoding='utf-8') as env_file:
                json.dump(environment, env_file)
        secret = os.environ.get('DEEPSEEK_API_KEY', '')
        secret_events = input == 'secret-events'
        tool_id = 'call-' + secret if input == 'secret-tool-id' else 'call-1'
        finish_reason = input.split(':', 1)[1] if input.startswith('reason:') else 'completed'
        event_finish_reason = 'blocked' if input == 'mismatched-reason' else finish_reason
        result_finish_reason = None if input == 'missing-result-reason' else finish_reason
        remembered = 'missing'
        for record in reversed(previous_history):
            previous_input = record.get('input')
            if isinstance(previous_input, str) and previous_input.startswith('remember:'):
                remembered = previous_input.split(':', 1)[1]
                break
        text = remembered if input == 'recall' else (secret if secret_events else 'hello')
        tool_arguments = '{"path":"' + (secret if secret_events else 'README.md') + '"}'
        events = [
            {'type': 'assistant/chunk', 'data': {'chunk': {'type': 'reasoning-delta', 'text': secret if secret_events else 'thinking'}}},
            {'type': 'tool/call', 'data': {'callId': tool_id, 'name': 'read', 'arguments': tool_arguments}},
            {'type': 'tool/result', 'data': {'message': {'source': {'callId': tool_id}, 'content': [{'type': 'tool-result', 'toolCallId': tool_id, 'content': [{'type': 'text', 'text': secret if secret_events else 'file'}]}]}}},
            {'type': 'assistant/chunk', 'data': {'chunk': {'type': 'text-delta', 'text': text}}},
            {'type': 'turn/end', 'data': {'reason': {'kind': event_finish_reason, **({'error': {'code': 'FAKE', 'message': 'provider failure'}} if event_finish_reason == 'error' else {})}}},
        ]
        if input == 'message-events':
            events = [
                {'type': 'assistant/message', 'data': {'message': {'content': [{'type': 'text', 'text': 'first'}]}}},
                {'type': 'assistant/message', 'data': {'message': {'content': [{'type': 'text', 'text': 'second'}]}}},
                {'type': 'turn/end', 'data': {'reason': {'kind': 'completed'}}},
            ]
        if input == 'malformed-frame':
            events = [
                {'type': 'assistant/chunk', 'data': {'chunk': {'type': 'text-delta', 'text': float('nan')}}},
            ]
        if input == 'malformed-notification':
            events = [
                {'type': 'assistant/chunk', 'data': {}},
            ]
        if input == 'concurrent-events':
            events = [
                {'type': 'assistant/chunk', 'data': {'chunk': {'type': 'text-delta', 'text': str(index)}}}
                for index in range(32)
            ] + [{'type': 'turn/end', 'data': {'reason': {'kind': 'completed'}}}]
        if input == 'missing-turn-end':
            events = events[:-1]
        if on_notification is not None:
            if input == 'concurrent-events':
                threads = [threading.Thread(
                    target=on_notification,
                    args=(Notification('session.event', {'sessionId': active_session, 'event': event}),),
                ) for event in events]
                for thread in threads:
                    thread.start()
                for thread in threads:
                    thread.join()
            else:
                for event in events:
                    on_notification(Notification('session.event', {'sessionId': active_session, 'event': event}))
        final_response = 'firstsecond' if input == 'message-events' else text
        return Result(active_session, final_response, result_finish_reason)
`, 'utf8');
    pythonPath = path.join(root, 'python-wrapper.sh');
    await writeFile(
      bridgeProxyPath,
      `
import select
import subprocess
import sys

capture_path = sys.argv[1]
python_path = sys.argv[2]
bridge = subprocess.Popen([python_path, *sys.argv[3:]], stdin=subprocess.PIPE)
try:
    with open(capture_path, 'ab') as capture:
        while bridge.poll() is None:
            readable, _, _ = select.select([sys.stdin.buffer], [], [], 0.1)
            if not readable:
                continue
            line = sys.stdin.buffer.readline()
            if not line:
                break
            capture.write(line)
            capture.flush()
            if bridge.stdin is None:
                break
            try:
                bridge.stdin.write(line)
                bridge.stdin.flush()
            except BrokenPipeError:
                break
finally:
    if bridge.stdin is not None:
        try:
            bridge.stdin.close()
        except BrokenPipeError:
            pass
return_code = bridge.wait()
raise SystemExit(return_code)
`,
      'utf8',
    );
    await writeFile(
      pythonPath,
      `#!/bin/sh\nprintf 'started\\n' >> "${root}/bridge-launches.txt"\nPYTHONPATH="${root}:${'${PYTHONPATH:-}'}" exec "${python}" "${bridgeProxyPath}" "${bridgeInputPath}" "${python}" "$@"\n`,
      'utf8',
    );
    await chmod(pythonPath, 0o755);
  });

  afterEach(async () => {
    await closeDeepSeekHarnessProcesses();
    await rm(root, { recursive: true, force: true });
  });

  it.each(['off', 'low', 'high', 'max'] as const)(
    'forwards explicit reasoning_effort=%s to the official SDK without changing model content',
    async (reasoningEffort) => {
      const response = await callDeepSeekHarness('worker', 'hello', {
        cwd: root,
        model: 'route/model:variant',
        providerOptions: asTestDeepSeekProviderOptions({
          pythonPath,
          sessionRoot: 'custom-dsh-home',
          cordis: 'FAKE_CAPTURE_KWARGS',
          requestTimeoutMs: 10_000,
          reasoningEffort,
        }),
      });
      const sdkOptions = JSON.parse(
        await readFile(path.join(root, 'sdk-kwargs.json'), 'utf8'),
      ) as Record<string, unknown>;

      expect(response).toMatchObject({ status: 'done', content: 'hello' });
      expect(sdkOptions.provider).toBe('route');
      expect(sdkOptions.model).toBe('model:variant');
      expect(sdkOptions.profile).toBe('sdk');
      expect(sdkOptions.dsh_home).toBe(path.join(root, 'custom-dsh-home'));
      expect(Object.prototype.hasOwnProperty.call(sdkOptions, 'session_root')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(sdkOptions, 'cordis')).toBe(false);
      expect(sdkOptions.patches).toEqual([
        path.join(root, 'FAKE_CAPTURE_KWARGS'),
      ]);
      expect(Object.prototype.hasOwnProperty.call(sdkOptions, 'reasoning_effort')).toBe(true);
      expect(sdkOptions.reasoning_effort).toBe(reasoningEffort);
    },
  );

  it('omits reasoning_effort from the bridge and SDK when the provider option is unset', async () => {
    const response = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      model: 'route/model/extra:variant',
      providerOptions: asTestDeepSeekProviderOptions({
        pythonPath,
        cordis: 'FAKE_CAPTURE_KWARGS',
        requestTimeoutMs: 10_000,
      }),
    });
    const sdkOptions = JSON.parse(
      await readFile(path.join(root, 'sdk-kwargs.json'), 'utf8'),
    ) as Record<string, unknown>;
    const startMessage = (await readFile(bridgeInputPath, 'utf8'))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line) as { type?: unknown; config?: Record<string, unknown> })
      .find((message) => message.type === 'start');
    expect(startMessage).toBeDefined();
    const startConfig = startMessage?.config;
    expect(startConfig).toBeDefined();

    expect(response).toMatchObject({ status: 'done', content: 'hello' });
    expect(Object.prototype.hasOwnProperty.call(startConfig, 'reasoningEffort')).toBe(false);
    expect(sdkOptions.provider).toBe('route');
    expect(sdkOptions.model).toBe('model/extra:variant');
    expect(sdkOptions.profile).toBe('sdk');
    expect(sdkOptions.dsh_home).toBe(path.join(root, '.takt', 'deepseek-harness'));
    expect(Object.prototype.hasOwnProperty.call(sdkOptions, 'session_root')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(sdkOptions, 'cordis')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(sdkOptions, 'reasoning_effort')).toBe(false);
  });

  it('rejects an SDK without the 0.1.2a3 constructor fields before creating a harness', async () => {
    await writeFile(path.join(root, 'FAKE_OLD_SDK'), '1', 'utf8');

    const response = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });

    expect(response.status).toBe('error');
    expect(response.content).toContain('0.1.2a3');
    expect(response.content).toContain('dsh_home');
    expect(response.content).toContain('reasoning_effort');
    expect(existsSync(path.join(root, 'bridge-start-configs.jsonl'))).toBe(false);
  });

  it('rejects an SDK/runtime package version mismatch before creating a harness', async () => {
    await writeFile(
      path.join(root, 'deepseek_harness_runtime_bin-0.1.2a3.dist-info', 'METADATA'),
      'Metadata-Version: 2.1\nName: deepseek-harness-runtime-bin\nVersion: 0.1.2a2\n',
      'utf8',
    );

    const response = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });

    expect(response.status).toBe('error');
    expect(response.content).toContain('exact supported release pair');
    expect(response.content).toContain("runtime='0.1.2a2'");
    expect(existsSync(path.join(root, 'bridge-start-configs.jsonl'))).toBe(false);
  });

  it.each(['', ' ', ' high ', 'HIGH', 'minimal', 'medium', 'xhigh', 'unknown'] as const)(
    'rejects invalid reasoning_effort=%j before starting the bridge',
    async (reasoningEffort) => {
      const counterFile = path.join(root, 'invalid-effort-bridge-starts.txt');
      const response = await callDeepSeekHarness('worker', 'hello', {
        cwd: root,
        providerOptions: asTestDeepSeekProviderOptions({
          pythonPath,
          sessionRoot: counterFile,
          requestTimeoutMs: 10_000,
          reasoningEffort,
        }),
      });

      expect(response.status).toBe('error');
      expect(response.content).toContain(JSON.stringify(reasoningEffort));
      expect(response.content).toContain('off');
      expect(response.content).toContain('low');
      expect(response.content).toContain('high');
      expect(response.content).toContain('max');
      expect(existsSync(path.join(root, 'bridge-launches.txt'))).toBe(false);
      expect(existsSync(counterFile)).toBe(false);
    },
  );

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
    expect(events
      .filter((event) => event.type === 'init' || event.type === 'result')
      .map((event) => event.data.sessionId))
      .toEqual([response.sessionId, response.sessionId]);

    const [configuration] = (await readFile(path.join(root, 'bridge-start-configs.jsonl'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(configuration).toMatchObject({
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash',
    });
  });

  it.each([
    ['openai/gpt-5.4', 'openai', 'gpt-5.4'],
    ['my-gateway/org/custom-model', 'my-gateway', 'org/custom-model'],
    ['my-gateway/ollama/qwen3.5:397b', 'my-gateway', 'ollama/qwen3.5:397b'],
    ['route//model', 'route', '/model'],
    [' unknown-route / unknown-model ', ' unknown-route ', ' unknown-model '],
    ['deepseek-v4-flash', 'deepseek-official', 'deepseek-v4-flash'],
    [' deepseek-v4-flash ', 'deepseek-official', ' deepseek-v4-flash '],
  ] as const)('passes the effective route and model separately to the SDK for %s', async (model, provider, modelId) => {
    const response = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      model,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });
    const [configuration] = (await readFile(path.join(root, 'bridge-start-configs.jsonl'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(response.status).toBe('done');
    expect(configuration).toMatchObject({ provider, model: modelId });
  });

  it.each([
    ['', '""'],
    ['   ', '   '],
    ['/model', '/model'],
    ['route/', 'route/'],
  ] as const)('rejects malformed model reference %s before starting the bridge', async (model, referenceContext) => {
    const response = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      model,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });

    expect(response.status).toBe('error');
    expect(response.content).toContain(referenceContext);
    expect(response.content).toMatch(/empty|route|model/iu);
    await expect(readFile(path.join(root, 'bridge-start-configs.jsonl'), 'utf8'))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each([
    [
      'unknown-route/known-model',
      'unknown-route',
      'known-model',
      'SDK rejected unknown provider route "unknown-route"',
    ],
    [
      'known-route/unknown-model',
      'known-route',
      'unknown-model',
      'SDK rejected unknown model "unknown-model"',
    ],
    [
      'not-found-route/known-model',
      'not-found-route',
      'known-model',
      'SDK provider route not found "not-found-route"',
    ],
    [
      'known-route/enoent-model',
      'known-route',
      'enoent-model',
      'ENOENT: SDK model not found "enoent-model"',
    ],
  ] as const)('reports the original reference and bridge/SDK failure for %s', async (reference, provider, modelId, sdkFailure) => {
    const events: Array<{ type: string; data: Record<string, unknown> }> = [];
    const response = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      model: reference,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
      onStream: (event) => events.push(event as { type: string; data: Record<string, unknown> }),
    });
    const [configuration] = (await readFile(path.join(root, 'bridge-start-configs.jsonl'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(response.status).toBe('error');
    expect(configuration).toMatchObject({ provider, model: modelId });
    expect(response.content).toContain(reference);
    expect(response.content).toContain(provider);
    expect(response.content).toContain(modelId);
    expect(response.content).toContain(sdkFailure);
    expect(events).toEqual(expect.arrayContaining([
      { type: 'error', data: { message: response.content, raw: response.content } },
      expect.objectContaining({
        type: 'result',
        data: expect.objectContaining({
          error: response.content,
          success: false,
          failureCategory: 'provider_error',
        }),
      }),
    ]));
    expect(events.some((event) => event.type === 'result' && event.data.success === true)).toBe(false);
  });

  it('sanitizes terminal control sequences in provider errors and stream events', async () => {
    const reference = '\u009d52;c;X\u007fterminal-route/terminal-diagnostic-model';
    const sanitizedReference = `DeepSeek Harness model reference ${JSON.stringify(reference)}`
      .replace('\u009d', '\\x9d')
      .replace('\u007f', '\\x7f');
    const events: Array<{ type: string; data: Record<string, unknown> }> = [];
    const response = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      model: reference,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
      onStream: (event) => events.push(event as { type: string; data: Record<string, unknown> }),
    });

    expect(response.status).toBe('error');
    expect(response.content).toContain(sanitizedReference);
    expect(response.content).toContain('SDK diagnostic');
    expect(response.content).toContain('raw');
    expect(response.content).toContain('\\x01');
    expect(response.content).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/u);

    const streamedFailureEvents = events.filter((event) => event.type === 'error' || event.type === 'result');
    expect(streamedFailureEvents).toHaveLength(2);
    const streamedMessages = streamedFailureEvents.flatMap((event) => Object.values(event.data)
      .filter((value): value is string => typeof value === 'string'));
    expect(streamedMessages).not.toHaveLength(0);
    for (const message of streamedMessages) {
      expect(message).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/u);
    }
    expect(streamedMessages.some((message) => message.includes(sanitizedReference))).toBe(true);
    expect(streamedMessages.some((message) => message.includes('SDK diagnostic'))).toBe(true);
  });

  it('preserves runtime setup diagnostics for a routed model', async () => {
    const reference = 'known-route/runtime-unavailable-model';
    const response = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      model: reference,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });

    expect(response.status).toBe('error');
    expect(response.content).toContain('Unable to start DeepSeek Harness Python bridge');
    expect(response.content).toContain('Install Python 3.10+ and deepseek-harness-sdk');
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
      providerOptions: asTestDeepSeekProviderOptions({
        pythonPath,
        requestTimeoutMs: 10_000,
        reasoningEffort: 'high',
      }),
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
      providerOptions: asTestDeepSeekProviderOptions({
        pythonPath,
        requestTimeoutMs: 10_000,
        reasoningEffort: 'high',
      }),
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

  it('rejects session identifiers that contain a known secret', async () => {
    const secret = 'deepseek-session-secret-789';
    const response = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      sessionId: `session-${secret}`,
      childProcessEnv: { DEEPSEEK_API_KEY: secret },
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });

    expect(response.status).toBe('error');
    expect(response.content).toContain('must not contain configured secret values');
    expect(response.sessionId).toBeUndefined();
  });

  it('rejects session identifiers containing credentials embedded in the configured base URL', async () => {
    const embeddedSecret = 'embedded-base-secret-012';
    const response = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      sessionId: `session-${embeddedSecret}`,
      providerOptions: {
        pythonPath,
        baseUrl: `https://deepseek-user:${embeddedSecret}@deepseek.example/v1`,
        requestTimeoutMs: 10_000,
      },
    });

    expect(response.status).toBe('error');
    expect(response.content).toContain('must not contain configured secret values');
    expect(response.content).not.toContain(embeddedSecret);
    expect(response.sessionId).toBeUndefined();
  });

  it('rejects encoded URL-userinfo credentials in opaque session identifiers', async () => {
    const encodedUsername = 'embedded%40user';
    const encodedPassword = 'embedded%2Fpassword';
    const response = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      sessionId: `session-${encodedUsername}`,
      providerOptions: {
        pythonPath,
        baseUrl: `https://${encodedUsername}:${encodedPassword}@deepseek.example/v1`,
        requestTimeoutMs: 10_000,
      },
    });

    expect(response.status).toBe('error');
    expect(response.content).toContain('must not contain configured secret values');
    expect(response.content).not.toContain(encodedUsername);
    expect(response.content).not.toContain(encodedPassword);
  });

  it('rejects tool identifiers that contain a configured secret', async () => {
    const secret = 'deepseek-tool-secret-345';
    const response = await callDeepSeekHarness('worker', 'secret-tool-id', {
      cwd: root,
      childProcessEnv: { DEEPSEEK_API_KEY: secret },
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });

    expect(response.status).toBe('error');
    expect(response.content).toContain('tool ID must not contain configured secret values');
    expect(response.content).not.toContain(secret);
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

  it('maps an SDK aborted finish reason to external_abort without reporting success', async () => {
    const events: Array<{ type: string; data: Record<string, unknown> }> = [];
    const response = await callDeepSeekHarness('worker', 'reason:aborted', {
      cwd: root,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
      onStream: (event) => events.push(event as { type: string; data: Record<string, unknown> }),
    });

    expect(response).toMatchObject({
      status: 'error',
      failureCategory: 'external_abort',
      error: response.content,
    });
    expect(response.content).toContain('DeepSeek Harness execution aborted');
    expect(response.content).not.toContain('provider bridge/SDK');
    expect(events).toEqual(expect.arrayContaining([
      { type: 'error', data: { message: response.content, raw: response.content } },
      expect.objectContaining({
        type: 'result',
        data: expect.objectContaining({
          error: response.content,
          success: false,
          failureCategory: 'external_abort',
        }),
      }),
    ]));
    expect(events.some((event) => event.type === 'result' && event.data.success === true)).toBe(false);
  });

  it.each([
    ['my-gateway/org/custom-model', 'my-gateway/org/custom-model'],
    [undefined, 'deepseek-v4-flash'],
  ] as const)('preserves structured provider error context for model %s', async (model, modelReference) => {
    const events: Array<{ type: string; data: Record<string, unknown> }> = [];
    const response = await callDeepSeekHarness('worker', 'reason:error', {
      cwd: root,
      ...(model === undefined ? {} : { model }),
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
      onStream: (event) => events.push(event as { type: string; data: Record<string, unknown> }),
    });

    expect(response).toMatchObject({
      status: 'error',
      failureCategory: 'provider_error',
      error: response.content,
    });
    expect(response.content).toContain(modelReference);
    expect(response.content).toContain('provider bridge/SDK');
    expect(response.content).toContain('FAKE: provider failure');
    expect(events).toEqual(expect.arrayContaining([
      { type: 'error', data: { message: response.content, raw: response.content } },
      expect.objectContaining({
        type: 'result',
        data: expect.objectContaining({
          error: response.content,
          success: false,
          failureCategory: 'provider_error',
        }),
      }),
    ]));
    expect(events.some((event) => event.type === 'result' && event.data.success === true)).toBe(false);
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

  it('keeps SDK stdout noise off the bridge protocol stream', async () => {
    const response = await callDeepSeekHarness('worker', 'malformed-json', {
      cwd: root,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });

    expect(response).toMatchObject({ status: 'done', content: 'hello' });
  });

  it('maps malformed JSON bridge output to a stream protocol error', async () => {
    const response = await callDeepSeekHarness('worker', 'malformed-frame', {
      cwd: root,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });

    expect(response.status).toBe('error');
    expect(response.failureCategory).toBe('provider_stream_parse_error');
    expect(response.content).toContain('malformed JSON');
  });

  it('maps a malformed notification frame to a stream protocol error', async () => {
    const response = await callDeepSeekHarness('worker', 'malformed-notification', {
      cwd: root,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });

    expect(response.status).toBe('error');
    expect(response.failureCategory).toBe('provider_stream_parse_error');
    expect(response.content).toContain('malformed assistant chunk');
  });

  it('serializes concurrent SDK notifications without corrupting JSONL frames', async () => {
    const response = await callDeepSeekHarness('worker', 'concurrent-events', {
      cwd: root,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });

    expect(response).toMatchObject({ status: 'done', content: 'hello' });
  });

  it.each(['missing-turn-end', 'missing-result-reason', 'mismatched-reason'] as const)(
    'rejects %s when the bridge result and turn end reason do not match',
    async (input) => {
      const response = await callDeepSeekHarness('worker', input, {
        cwd: root,
        providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
      });

      expect(response.status).toBe('error');
      expect(response.failureCategory).toBe('provider_stream_parse_error');
      expect(response.content).toContain('finishReason did not match');
    },
  );

  it('preserves credential-like and known-secret prompt text', async () => {
    const secret = 'prompt-secret-789';
    const prompt = `capture-prompt: preserve DEEPSEEK_API_KEY=${secret} exactly`;
    const response = await callDeepSeekHarness('worker', prompt, {
      cwd: root,
      childProcessEnv: { DEEPSEEK_API_KEY: secret },
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });

    expect(response.status).toBe('done');
    expect(await readFile(path.join(root, 'received-prompt.txt'), 'utf8')).toBe(prompt);
  });

  it('isolates bridge credentials from unrelated child environment variables', async () => {
    const response = await callDeepSeekHarness('worker', 'inspect-env', {
      cwd: root,
      childProcessEnv: {
        DEEPSEEK_API_KEY: 'deepseek-env-secret',
        DEEPSEEK_BASE_URL: 'https://deepseek.example/v1',
        OPENAI_API_KEY: 'unrelated-secret',
        TAKT_OBSERVABILITY_ENABLED: '1',
        HOME: 'unrelated-home',
        DSH_RUNTIME_MODE: 'node',
      },
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });
    const bridgeEnvironment = JSON.parse(await readFile(path.join(root, 'bridge-env.json'), 'utf8')) as Record<string, string | null>;

    expect(response.status).toBe('done');
    expect(bridgeEnvironment.DEEPSEEK_API_KEY).toBe('deepseek-env-secret');
    expect(bridgeEnvironment.DEEPSEEK_BASE_URL).toBe('https://deepseek.example/v1');
    expect(bridgeEnvironment.TAKT_OBSERVABILITY_ENABLED).toBe('1');
    expect(Object.prototype.hasOwnProperty.call(bridgeEnvironment, 'OPENAI_API_KEY')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(bridgeEnvironment, 'HOME')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(bridgeEnvironment, 'DSH_RUNTIME_MODE')).toBe(false);
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

  it.each(['', '.', '..', '../outside', 'nested/session', 'C:\\outside'] as const)(
    'rejects path-like session IDs before starting the bridge: %s',
    async (sessionId) => {
      const response = await callDeepSeekHarness('worker', 'hello', {
        cwd: root,
        sessionId,
        providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
      });

      expect(response.status).toBe('error');
      expect(response.content).toContain('path-safe identifier');
    },
  );

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

  it('reuses one process when bare and explicit default routes have the same effective identity', async () => {
    const counterFile = path.join(root, 'default-route-starts.txt');
    const first = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      model: 'deepseek-v4-flash',
      sessionId: 'default-route-session',
      providerOptions: { pythonPath, sessionRoot: counterFile, requestTimeoutMs: 10_000 },
    });
    const second = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      model: 'deepseek-official/deepseek-v4-flash',
      sessionId: 'default-route-session',
      providerOptions: { pythonPath, sessionRoot: counterFile, requestTimeoutMs: 10_000 },
    });

    expect(first.status).toBe('done');
    expect(second.status).toBe('done');
    expect((await readFile(counterFile, 'utf8')).trim().split('\n')).toEqual(['initialized']);
  });

  it('rejects a session when the effective route or model changes', async () => {
    const counterFile = path.join(root, 'routing-session-starts.txt');
    const calls = [
      ['openai/gpt-5.4', 'done'],
      ['openai/gpt-5.5', 'error'],
      ['anthropic/gpt-5.4', 'error'],
    ] as const;
    const responses = [] as Array<Awaited<ReturnType<typeof callDeepSeekHarness>>>;

    for (const [model] of calls) {
      responses.push(await callDeepSeekHarness('worker', 'hello', {
        cwd: root,
        model,
        sessionId: 'routing-session',
        providerOptions: { pythonPath, sessionRoot: counterFile, requestTimeoutMs: 10_000 },
      }));
    }

    expect(responses.map((response) => response.status)).toEqual(calls.map(([, status]) => status));
    expect(responses[1]?.content).toContain('different project, session root, or bridge configuration');
    expect(responses[2]?.content).toContain('different project, session root, or bridge configuration');
    expect((await readFile(counterFile, 'utf8')).trim().split('\n')).toEqual(['initialized']);
  });

  it.each([
    ['off', 'low'],
    ['low', 'high'],
    ['high', 'max'],
    ['max', undefined],
    [undefined, 'off'],
  ] as const)('reuses the logical session while replacing the bridge for %s -> %s reasoning effort', async (firstEffort, secondEffort) => {
    const counterFile = path.join(root, `reasoning-effort-${firstEffort ?? 'unset'}-${secondEffort ?? 'unset'}.txt`);
    const optionsFor = (reasoningEffort: 'off' | 'low' | 'high' | 'max' | undefined) => asTestDeepSeekProviderOptions({
      pythonPath,
      sessionRoot: counterFile,
      requestTimeoutMs: 10_000,
      ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
    });
    const firstPrompt = `remember:${firstEffort ?? 'unset'}-token`;
    const first = await callDeepSeekHarness('worker', firstPrompt, {
      cwd: root,
      model: 'route/model:variant',
      sessionId: 'reasoning-effort-session',
      providerOptions: optionsFor(firstEffort),
    });
    const second = await callDeepSeekHarness('worker', 'recall', {
      cwd: root,
      model: 'route/model:variant',
      sessionId: 'reasoning-effort-session',
      providerOptions: optionsFor(secondEffort),
    });
    const configurations = (await readFile(path.join(root, 'bridge-start-configs.jsonl'), 'utf8'))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const history = (await readFile(path.join(root, 'sdk-session-history.jsonl'), 'utf8'))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const lifecycle = (await readFile(path.join(root, 'bridge-lifecycle.jsonl'), 'utf8'))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(first).toMatchObject({ status: 'done', sessionId: 'reasoning-effort-session' });
    expect(second).toMatchObject({ status: 'done', sessionId: 'reasoning-effort-session' });
    expect(configurations.map((configuration) => configuration.reasoning_effort ?? 'unset'))
      .toEqual([firstEffort ?? 'unset', secondEffort ?? 'unset']);
    expect(history.map(({ input, sessionId }) => ({ input, sessionId }))).toEqual([
      { input: firstPrompt, sessionId: 'reasoning-effort-session' },
      { input: 'recall', sessionId: 'reasoning-effort-session' },
    ]);
    expect(second.content).toBe(`${firstEffort ?? 'unset'}-token`);
    expect(lifecycle.filter(({ event }) => event === 'start')).toHaveLength(2);
    expect(lifecycle.filter(({ event }) => event === 'close')).toHaveLength(1);
    expect((await readFile(counterFile, 'utf8')).trim().split('\n')).toHaveLength(2);
  });

  it('uses forced process termination when the SDK close operation fails', async () => {
    const response = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      providerOptions: asTestDeepSeekProviderOptions({
        pythonPath,
        cordis: 'FAKE_CLOSE_FAILURE',
        requestTimeoutMs: 10_000,
      }),
    });
    const lifecycle = (await readFile(path.join(root, 'bridge-lifecycle.jsonl'), 'utf8'))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(response.status).toBe('error');
    expect(response.content).toContain('close failure');
    expect(lifecycle).toEqual([
      { effort: 'unset', event: 'start' },
      { effort: 'unset', event: 'close' },
    ]);
  });

  it('propagates a close failure while retiring a replaced session bridge', async () => {
    const sessionId = 'replacement-close-failure-session';
    const optionsFor = (reasoningEffort: 'low' | 'high') => asTestDeepSeekProviderOptions({
      pythonPath,
      sessionRoot: path.join(root, 'replacement-close-failure-root'),
      cordis: 'FAKE_CLOSE_FAILURE',
      requestTimeoutMs: 10_000,
      reasoningEffort,
    });

    const started = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      sessionId,
      providerOptions: optionsFor('low'),
    });
    const replaced = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      sessionId,
      providerOptions: optionsFor('high'),
    });

    expect(started).toMatchObject({ status: 'done', sessionId });
    expect(replaced.status).toBe('error');
    expect(replaced.content).toContain('close failure');
  });

  it('propagates a close failure from global process cleanup', async () => {
    const started = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      sessionId: 'global-close-failure-session',
      providerOptions: asTestDeepSeekProviderOptions({
        pythonPath,
        cordis: 'FAKE_CLOSE_FAILURE',
        requestTimeoutMs: 10_000,
      }),
    });
    expect(started.status).toBe('done');

    await expect(closeDeepSeekHarnessProcesses()).rejects.toThrow('close failure');
  });

  it('preserves close and termination failures from global process cleanup', async () => {
    const started = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      sessionId: 'global-combined-cleanup-failure-session',
      providerOptions: asTestDeepSeekProviderOptions({
        pythonPath,
        cordis: 'FAKE_CLOSE_FAILURE',
        requestTimeoutMs: 10_000,
      }),
    });
    expect(started.status).toBe('done');

    const originalKill = process.kill.bind(process);
    const killSpy = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      if (typeof pid === 'number' && pid < 0 && signal === 'SIGTERM') {
        throw new Error('forced termination failure');
      }
      return originalKill(pid, signal);
    });
    try {
      const error = await closeDeepSeekHarnessProcesses().then(
        () => undefined,
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(Error);
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain('close failure');
      expect(message).toContain('forced termination failure');
    } finally {
      killSpy.mockRestore();
    }
  });

  it('reports both operation and cleanup failures from a one-shot call', async () => {
    const response = await callDeepSeekHarness('worker', 'jsonrpc-failure', {
      cwd: root,
      providerOptions: asTestDeepSeekProviderOptions({
        pythonPath,
        cordis: 'FAKE_CLOSE_FAILURE',
        requestTimeoutMs: 10_000,
      }),
    });

    expect(response.status).toBe('error');
    expect(response.content).toContain('jsonrpc failure');
    expect(response.content).toContain('close failure');
  });

  it('serializes concurrent replacement of the same logical session', async () => {
    const sessionId = 'replacement-race-session';
    const sessionRoot = path.join(root, 'replacement-race-root');
    const barrier = path.join(root, 'FAKE_CLOSE_BARRIER');
    const baseOptions = {
      pythonPath,
      sessionRoot,
      cordis: barrier,
      requestTimeoutMs: 10_000,
    };
    const started = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      sessionId,
      providerOptions: asTestDeepSeekProviderOptions({
        ...baseOptions,
        reasoningEffort: 'low',
      }),
    });
    expect(started).toMatchObject({ status: 'done', sessionId });

    const firstReplacement = callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      sessionId,
      providerOptions: asTestDeepSeekProviderOptions({
        ...baseOptions,
        reasoningEffort: 'high',
      }),
    });
    await waitForFile(`${barrier}.entered`);
    const secondReplacement = callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      sessionId,
      providerOptions: asTestDeepSeekProviderOptions({
        ...baseOptions,
        reasoningEffort: 'high',
      }),
    });
    await writeFile(`${barrier}.release`, 'release', 'utf8');

    const responses = await Promise.all([firstReplacement, secondReplacement]);
    expect(responses).toEqual([
      expect.objectContaining({ status: 'done', sessionId }),
      expect.objectContaining({ status: 'done', sessionId }),
    ]);

    await closeDeepSeekHarnessProcesses();
    const configurations = (await readFile(path.join(root, 'bridge-start-configs.jsonl'), 'utf8'))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const lifecycle = (await readFile(path.join(root, 'bridge-lifecycle.jsonl'), 'utf8'))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(configurations.map((configuration) => configuration.reasoning_effort ?? 'unset'))
      .toEqual(['low', 'high']);
    expect(lifecycle.filter(({ event, effort }) => event === 'start' && effort === 'high')).toHaveLength(1);
    expect(lifecycle.filter(({ event, effort }) => event === 'close' && effort === 'low')).toHaveLength(1);
    expect(lifecycle.filter(({ event, effort }) => event === 'close' && effort === 'high')).toHaveLength(1);
  });

  it('serializes global cleanup with an in-flight session replacement', async () => {
    const sessionId = 'replacement-cleanup-race-session';
    const sessionRoot = path.join(root, 'replacement-cleanup-race-root');
    const barrier = path.join(root, 'FAKE_CLOSE_BARRIER');
    const baseOptions = {
      pythonPath,
      sessionRoot,
      cordis: barrier,
      requestTimeoutMs: 10_000,
    };
    const started = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      sessionId,
      providerOptions: asTestDeepSeekProviderOptions({
        ...baseOptions,
        reasoningEffort: 'low',
      }),
    });
    expect(started).toMatchObject({ status: 'done', sessionId });

    const replacement = callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      sessionId,
      providerOptions: asTestDeepSeekProviderOptions({
        ...baseOptions,
        reasoningEffort: 'high',
      }),
    });
    await waitForFile(`${barrier}.entered`);
    const cleanup = closeDeepSeekHarnessProcesses();
    await writeFile(`${barrier}.release`, 'release', 'utf8');

    const response = await replacement;
    await cleanup;
    expect(response).toMatchObject({ status: 'done', sessionId });

    const lifecycle = (await readFile(path.join(root, 'bridge-lifecycle.jsonl'), 'utf8'))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(lifecycle.filter(({ event, effort }) => event === 'start' && effort === 'high')).toHaveLength(1);
    expect(lifecycle.filter(({ event, effort }) => event === 'close' && effort === 'low')).toHaveLength(1);
    expect(lifecycle.filter(({ event, effort }) => event === 'close' && effort === 'high')).toHaveLength(1);
  });

  it('propagates a bridge termination failure from process cleanup', async () => {
    const sessionId = 'cleanup-failure-session';
    const started = await callDeepSeekHarness('worker', 'hello', {
      cwd: root,
      sessionId,
      providerOptions: { pythonPath, requestTimeoutMs: 10_000 },
    });
    expect(started).toMatchObject({ status: 'done', sessionId });

    const originalKill = process.kill.bind(process);
    const killSpy = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      if (typeof pid === 'number' && pid < 0 && signal === 'SIGTERM') {
        throw new Error('forced termination failure');
      }
      return originalKill(pid, signal);
    });
    try {
      await expect(closeDeepSeekHarnessProcesses()).rejects.toThrow('forced termination failure');
    } finally {
      killSpy.mockRestore();
    }
  });

  it('rejects a relative session root that traverses a symlink outside the project', async () => {
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), 'takt-deepseek-harness-outside-'));
    try {
      const outsideSessionFile = path.join(outsideRoot, 'session.db');
      const linkedSessionFile = path.join(root, 'session-link');
      await writeFile(outsideSessionFile, 'outside\n', 'utf8');
      await symlink(outsideSessionFile, linkedSessionFile, 'file');

      const response = await callDeepSeekHarness('worker', 'hello', {
        cwd: root,
        providerOptions: {
          pythonPath,
          sessionRoot: 'session-link',
          requestTimeoutMs: 10_000,
        },
      });

      expect(response.status).toBe('error');
      expect(response.content).toContain('session_root');
      expect(response.content).toContain('symlinks');
      expect(await readFile(outsideSessionFile, 'utf8')).toBe('outside\n');
    } finally {
      await rm(outsideRoot, { recursive: true, force: true });
    }
  });

  it('rejects a relative Cordis path that traverses a symlink outside the project', async () => {
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), 'takt-deepseek-harness-outside-'));
    try {
      const outsideCordis = path.join(outsideRoot, 'cordis.yml');
      const linkedCordis = path.join(root, 'cordis-link.yml');
      await writeFile(outsideCordis, 'outside\n', 'utf8');
      await symlink(outsideCordis, linkedCordis, 'file');

      const response = await callDeepSeekHarness('worker', 'hello', {
        cwd: root,
        providerOptions: {
          pythonPath,
          cordis: 'cordis-link.yml',
          requestTimeoutMs: 10_000,
        },
      });

      expect(response.status).toBe('error');
      expect(response.content).toContain('cordis');
      expect(await readFile(outsideCordis, 'utf8')).toBe('outside\n');
    } finally {
      await rm(outsideRoot, { recursive: true, force: true });
    }
  });

  it('reuses a session through canonical project and session-root aliases', async () => {
    const aliasContainer = await mkdtemp(path.join(os.tmpdir(), 'takt-deepseek-harness-alias-'));
    try {
      const sharedSessionFile = path.join(root, 'same-project-session.db');
      const projectAlias = path.join(aliasContainer, 'project-alias');
      const aliasedSessionFile = path.join(aliasContainer, 'same-project-session-alias.db');
      await writeFile(sharedSessionFile, '', 'utf8');
      await symlink(root, projectAlias, 'dir');
      await symlink(sharedSessionFile, aliasedSessionFile, 'file');

      const first = await callDeepSeekHarness('worker', 'hello', {
        cwd: root,
        sessionId: 'canonical-alias-session',
        providerOptions: {
          pythonPath,
          sessionRoot: sharedSessionFile,
          requestTimeoutMs: 10_000,
        },
      });
      const second = await callDeepSeekHarness('worker', 'hello', {
        cwd: projectAlias,
        sessionId: 'canonical-alias-session',
        providerOptions: {
          pythonPath,
          sessionRoot: aliasedSessionFile,
          requestTimeoutMs: 10_000,
        },
      });

      expect(first).toMatchObject({ status: 'done', sessionId: 'canonical-alias-session' });
      expect(second).toMatchObject({ status: 'done', sessionId: 'canonical-alias-session' });
      expect((await readFile(sharedSessionFile, 'utf8')).trim().split('\n')).toEqual(['initialized']);
    } finally {
      await rm(aliasContainer, { recursive: true, force: true });
    }
  });

  it('canonicalizes session root aliases before cross-project binding checks', async () => {
    const otherRoot = await mkdtemp(path.join(os.tmpdir(), 'takt-deepseek-harness-other-'));
    try {
      const sharedSessionFile = path.join(root, 'shared-session.db');
      const aliasedSessionFile = path.join(otherRoot, 'shared-session-alias.db');
      await writeFile(sharedSessionFile, '', 'utf8');
      await symlink(sharedSessionFile, aliasedSessionFile, 'file');

      const first = await callDeepSeekHarness('worker', 'hello', {
        cwd: root,
        sessionId: 'shared-root-owner',
        providerOptions: {
          pythonPath,
          sessionRoot: sharedSessionFile,
          requestTimeoutMs: 10_000,
        },
      });
      const second = await callDeepSeekHarness('worker', 'hello', {
        cwd: otherRoot,
        sessionId: 'different-project',
        providerOptions: {
          pythonPath,
          sessionRoot: aliasedSessionFile,
          requestTimeoutMs: 10_000,
        },
      });

      expect(first.status).toBe('done');
      expect(second.status).toBe('error');
      expect(second.content).toContain('different project');
      expect((await readFile(sharedSessionFile, 'utf8')).trim().split('\n')).toEqual(['initialized']);
    } finally {
      await rm(otherRoot, { recursive: true, force: true });
    }
  });

  it('rejects reusing a closed one-shot session root from another project', async () => {
    const otherRoot = await mkdtemp(path.join(os.tmpdir(), 'takt-deepseek-harness-other-'));
    try {
      const sessionRoot = path.join(root, 'shared-one-shot-sessions');
      const first = await callDeepSeekHarness('worker', 'hello', {
        cwd: root,
        providerOptions: { pythonPath, sessionRoot, requestTimeoutMs: 10_000 },
      });
      const second = await callDeepSeekHarness('worker', 'hello', {
        cwd: otherRoot,
        providerOptions: { pythonPath, sessionRoot, requestTimeoutMs: 10_000 },
      });

      expect(first.status).toBe('done');
      expect(second.status).toBe('error');
      expect(second.content).toContain('different project');
    } finally {
      await rm(otherRoot, { recursive: true, force: true });
    }
  });

  it('rejects reusing a session root and session id from another project', async () => {
    const otherRoot = await mkdtemp(path.join(os.tmpdir(), 'takt-deepseek-harness-other-'));
    try {
      const sessionRoot = path.join(root, 'shared-sessions.txt');
      const first = await callDeepSeekHarness('worker', 'hello', {
        cwd: root,
        sessionId: 'cross-project-session',
        providerOptions: { pythonPath, sessionRoot, requestTimeoutMs: 10_000 },
      });
      const second = await callDeepSeekHarness('worker', 'hello', {
        cwd: otherRoot,
        sessionId: 'cross-project-session',
        providerOptions: { pythonPath, sessionRoot, requestTimeoutMs: 10_000 },
      });

      expect(first.status).toBe('done');
      expect(second.status).toBe('error');
      expect(second.content).toContain('different project');
    } finally {
      await rm(otherRoot, { recursive: true, force: true });
    }
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

    expect(response.status).toBe('error');
    expect(response.content).toContain('timed out');
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
