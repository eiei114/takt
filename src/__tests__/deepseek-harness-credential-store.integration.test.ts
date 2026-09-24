import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  callDeepSeekHarness,
  closeDeepSeekHarnessProcesses,
} from '../infra/deepseek-harness/index.js';
import { getGlobalConfigDir } from '../infra/config/paths.js';

const liveEnabled = process.env.TAKT_DEEPSEEK_HARNESS_LIVE === '1';
const supportedRuntime = (
  (process.platform === 'linux' && (process.arch === 'x64' || process.arch === 'arm64'))
  || (process.platform === 'darwin' && process.arch === 'arm64')
);
const managedEnvironmentDir = path.join(getGlobalConfigDir(), 'deepseek-harness', 'venv');
const managedEnvironmentAvailable = existsSync(managedEnvironmentDir);
const suiteEnabled = liveEnabled && supportedRuntime && managedEnvironmentAvailable;

const STORE_KEY = 'dummy-store-credential-1487';
const UPDATED_STORE_KEY = 'dummy-updated-credential-1487';
const ENV_KEY = 'dummy-env-credential-1487';
const REQUEST_TIMEOUT_MS = 120_000;
const WATCHER_TIMEOUT_MS = 20_000;
const WATCHER_POLL_INTERVAL_MS = 500;

interface RecordedRequest {
  authorization: string | undefined;
  body: string;
}

type MockMode = 'ok' | 'auth-echo';

interface MockEndpoint {
  baseUrl: string;
  requests: RecordedRequest[];
  setMode: (mode: MockMode) => void;
  close: () => Promise<void>;
}

function writeEventStream(response: import('node:http').ServerResponse): void {
  response.writeHead(200, { 'Content-Type': 'text/event-stream' });
  for (const [delta, finish] of [
    [{ role: 'assistant', content: 'confirmed' }, null],
    [{}, 'stop'],
  ] as const) {
    response.write(`data: ${JSON.stringify({
      id: 'mock',
      object: 'chat.completion.chunk',
      created: 0,
      model: 'deepseek-v4-flash',
      choices: [{ index: 0, delta, finish_reason: finish }],
    })}\n\n`);
  }
  response.write('data: [DONE]\n\n');
  response.end();
}

async function startMockEndpoint(): Promise<MockEndpoint> {
  const requests: RecordedRequest[] = [];
  let mode: MockMode = 'ok';
  const server: Server = createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      body += chunk;
    });
    request.on('end', () => {
      requests.push({ authorization: request.headers.authorization, body });
      if (mode === 'auth-echo') {
        response.writeHead(401, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: { message: `rejected ${STORE_KEY}` } }));
        return;
      }
      writeEventStream(response);
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('mock endpoint did not bind a TCP port');
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    setMode: (next) => {
      mode = next;
    },
    close: () => new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
  };
}

function decompressSessionFrames(data: Buffer): Buffer {
  const frames: Buffer[] = [];
  let offset = 0;
  while (offset < data.length) {
    // Node's one-shot Zstd decoder stops after the first frame. Harness appends
    // frames, so scanning only that first frame silently misses later events.
    const decoded = zstdDecompressSync(data.subarray(offset), { info: true }) as unknown as {
      buffer: Buffer;
      engine: { bytesWritten: number };
    };
    if (decoded.engine.bytesWritten <= 0) {
      throw new Error('Session decoder did not consume a frame');
    }
    offset += decoded.engine.bytesWritten;
    frames.push(decoded.buffer);
  }
  return Buffer.concat(frames);
}

describe('DeepSeek Harness persisted session inspection', () => {
  it('scans later concatenated Zstd frames instead of just the session header', () => {
    const data = Buffer.concat([
      zstdCompressSync(Buffer.from('{"type":"session/header"}\n')),
      zstdCompressSync(Buffer.from(JSON.stringify({ message: STORE_KEY }) + '\n')),
    ]);
    expect(decompressSessionFrames(data).includes(STORE_KEY)).toBe(true);
  });

  it('rejects an unreadable frame instead of treating it as secret-free', () => {
    expect(() => decompressSessionFrames(Buffer.from('invalid compressed session'))).toThrow();
  });
});

function collectSecretHits(directory: string, secret: string): string[] {
  const hits: string[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      let data: Buffer = readFileSync(entryPath);
      if (entryPath.endsWith('.zstd')) {
        data = decompressSessionFrames(data);
      }
      if (data.includes(secret)) {
        hits.push(entryPath);
      }
    }
  };
  visit(directory);
  return hits;
}

describe.skipIf(!suiteEnabled)('DeepSeek Harness credential store integration', () => {
  let root: string;
  let workspace: string;
  let sourceHome: string;
  let dshHome: string;
  let storePath: string;
  let settingsPath: string;
  let endpoint: MockEndpoint;

  async function writeStore(content: string): Promise<void> {
    await writeFile(storePath, content, 'utf8');
    await chmod(storePath, 0o600);
  }

  async function writeSettings(baseUrl: string, reference = 'DEEPSEEK_API_KEY'): Promise<void> {
    await writeFile(settingsPath, [
      'llm-deepseek:',
      `  apiKeyEnv: ${reference}`,
      `  baseURL: ${baseUrl}`,
      '',
    ].join('\n'), 'utf8');
  }

  async function runTurn(options: {
    prompt?: string;
    sessionId?: string;
    model?: string;
    childProcessEnv?: Readonly<Record<string, string>>;
  } = {}): Promise<Awaited<ReturnType<typeof callDeepSeekHarness>>> {
    return callDeepSeekHarness('live-smoke', options.prompt ?? 'Return ok.', {
      cwd: workspace,
      ...(options.sessionId === undefined ? {} : { sessionId: options.sessionId }),
      ...(options.childProcessEnv === undefined ? {} : { childProcessEnv: options.childProcessEnv }),
      ...(options.model === undefined ? {} : { model: options.model }),
      providerOptions: { baseUrl: endpoint.baseUrl, requestTimeoutMs: REQUEST_TIMEOUT_MS },
    });
  }

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'takt-deepseek-credential-store-'));
    workspace = path.join(root, 'workspace');
    sourceHome = path.join(root, 'source-home');
    const managedRoot = path.join(root, 'config', 'deepseek-harness');
    dshHome = path.join(managedRoot, 'dsh-home');
    storePath = path.join(sourceHome, '.credentials.yaml');
    settingsPath = path.join(sourceHome, 'settings.yaml');
    await mkdir(workspace, { recursive: true });
    await mkdir(sourceHome, { recursive: true });
    await mkdir(dshHome, { recursive: true });
    await symlink(managedEnvironmentDir, path.join(managedRoot, 'venv'));
    endpoint = await startMockEndpoint();
    await writeStore(`version: 1\nrefs:\n  DEEPSEEK_API_KEY: ${STORE_KEY}\n`);
    await writeSettings(endpoint.baseUrl);
    vi.stubEnv('TAKT_CONFIG_DIR', path.join(root, 'config'));
    vi.stubEnv('DSH_HOME', sourceHome);
    vi.stubEnv('DEEPSEEK_API_KEY', undefined);
    vi.stubEnv('DEEPSEEK_BASE_URL', undefined);
  });

  afterEach(async () => {
    await closeDeepSeekHarnessProcesses();
    await endpoint?.close();
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it('resolves the credential from the source store without reading or changing it', async () => {
    const storeBefore = await readFile(storePath);
    const modeBefore = (await stat(storePath)).mode & 0o777;

    const response = await runTurn();

    expect(response.status).toBe('done');
    expect(endpoint.requests).toHaveLength(1);
    expect(endpoint.requests[0]?.authorization).toContain(STORE_KEY);
    expect(response.content).not.toContain(STORE_KEY);
    expect(await readFile(storePath)).toEqual(storeBefore);
    expect((await stat(storePath)).mode & 0o777).toBe(modeBefore);
    expect(existsSync(path.join(dshHome, 'sessions'))).toBe(true);
    expect(existsSync(path.join(dshHome, '.credentials.yaml'))).toBe(false);
  });

  it('prefers a same-reference launch environment value over the store', async () => {
    const response = await runTurn({ childProcessEnv: { DEEPSEEK_API_KEY: ENV_KEY } });

    expect(response.status).toBe('done');
    expect(endpoint.requests.at(-1)?.authorization).toContain(ENV_KEY);
    expect(endpoint.requests.at(-1)?.authorization).not.toContain(STORE_KEY);
  });

  it('does not substitute a different reference for the selected reference', async () => {
    await writeSettings(endpoint.baseUrl, 'CUSTOM_DSH_KEY');
    const response = await runTurn({ childProcessEnv: { DEEPSEEK_API_KEY: ENV_KEY } });

    expect(response.status).toBe('error');
    expect(endpoint.requests).toHaveLength(0);
    expect(response.content).not.toContain(STORE_KEY);
    expect(response.content).not.toContain(ENV_KEY);
    await expect(readFile(storePath, 'utf8')).resolves.toContain(STORE_KEY);
  });

  it('reflects a store update on a later turn of the same session', async () => {
    const first = await runTurn({ sessionId: 'store-update-session', prompt: 'First turn.' });
    expect(first.status).toBe('done');
    expect(endpoint.requests.at(-1)?.authorization).toContain(STORE_KEY);

    await writeStore(`version: 1\nrefs:\n  DEEPSEEK_API_KEY: ${UPDATED_STORE_KEY}\n`);

    let attempts = 0;
    await vi.waitFor(async () => {
      attempts += 1;
      const turn = await runTurn({ sessionId: 'store-update-session', prompt: `Reload check ${attempts}.` });
      expect(turn.status).toBe('done');
      expect(endpoint.requests.at(-1)?.authorization).toContain(UPDATED_STORE_KEY);
    }, { timeout: WATCHER_TIMEOUT_MS, interval: WATCHER_POLL_INTERVAL_MS });
  });

  it('fails a later turn after the store entry is deleted without sending another request', async () => {
    const first = await runTurn({ sessionId: 'store-delete-session', prompt: 'First turn.' });
    expect(first.status).toBe('done');

    await rm(storePath);

    let turnsAfterDeletion = 0;
    let requestsBeforeFailure: number | undefined;
    let failed: Awaited<ReturnType<typeof callDeepSeekHarness>> | undefined;
    await vi.waitFor(async () => {
      turnsAfterDeletion += 1;
      const requestsBeforeTurn = endpoint.requests.length;
      const turn = await runTurn({ sessionId: 'store-delete-session', prompt: `After deletion ${turnsAfterDeletion}.` });
      if (turn.status !== 'done') {
        failed = turn;
        requestsBeforeFailure = requestsBeforeTurn;
      }
      expect(failed).toBeDefined();
    }, { timeout: WATCHER_TIMEOUT_MS, interval: WATCHER_POLL_INTERVAL_MS });

    expect(failed?.content).not.toContain(STORE_KEY);
    // The official runtime may complete one more turn from its last-good credential while its
    // watcher observes the deletion; the turn that fails must not send another request.
    expect(endpoint.requests.length).toBe(requestsBeforeFailure);
  });

  it('reports a malformed store without echoing the document or its path', async () => {
    await writeStore('version: 1\nrefs: [broken\n');
    const response = await runTurn();

    expect(response.status).toBe('error');
    expect(endpoint.requests).toHaveLength(0);
    expect(response.content).not.toContain('broken');
    expect(response.content).not.toContain(storePath);
    expect(response.content).toContain('DSH_HOME');
  });

  it('keeps an echoed dummy credential out of TAKT output and the runtime session store', async () => {
    endpoint.setMode('auth-echo');
    const response = await runTurn({ prompt: 'Trigger the mocked auth rejection.' });

    await closeDeepSeekHarnessProcesses();

    expect(endpoint.requests).toHaveLength(1);
    expect(endpoint.requests[0]?.authorization).toContain(STORE_KEY);
    expect(response.status).toBe('error');
    expect(response.content).not.toContain(STORE_KEY);
    expect(response.content).toMatch(/credential|auth/iu);

    const leakedIntoRuntimeStore = collectSecretHits(dshHome, STORE_KEY);
    expect(
      leakedIntoRuntimeStore,
      'the pinned DeepSeek Harness runtime persisted the echoed dummy credential into its session store',
    ).toEqual([]);
  });
});
