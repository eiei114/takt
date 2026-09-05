import { spawn, type ChildProcess } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  installManagedDeepSeekHarness,
  resolveDeepSeekHarnessManagedPaths,
  validateDeepSeekHarnessInstallation,
} from '../infra/deepseek-harness/index.js';
import { getDeepSeekHarnessConstructorArguments } from '../infra/deepseek-harness/managed-venv.js';

const PINNED_VERSION = '0.1.1rc1';
const temporaryRoots: string[] = [];

async function createTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'takt-deepseek-managed-'));
  temporaryRoots.push(root);
  return root;
}

async function createProbeExecutable(
  root: string,
  result: Record<string, unknown>,
): Promise<string> {
  const executable = path.join(root, 'probe-python.sh');
  await writeFile(
    executable,
    `#!/bin/sh\nprintf '%s\\n' '${JSON.stringify(result)}'\n`,
    'utf8',
  );
  await chmod(executable, 0o755);
  return executable;
}

async function createHangingProbeExecutable(root: string): Promise<string> {
  const executable = path.join(root, 'hanging-probe.sh');
  await writeFile(executable, '#!/bin/sh\nwhile :; do sleep 1; done\n', 'utf8');
  await chmod(executable, 0o755);
  return executable;
}

async function createBootstrapExecutable(root: string, pipArgsPath: string): Promise<string> {
  const executable = path.join(root, 'bootstrap-python.sh');
  const managedPython = `#!/bin/sh
set -eu
if [ "$1" = "-m" ] && [ "$2" = "pip" ]; then
  printf '%s\\n' "$@" > '${pipArgsPath}'
  exit 0
fi
if [ "$1" = "-c" ]; then
  printf '%s\\n' '{"pythonVersion":[3,10],"sdkVersion":"${PINNED_VERSION}","runtimeVersion":"${PINNED_VERSION}"}'
  exit 0
fi
exit 1
`;
  await writeFile(
    executable,
    `#!/bin/sh
set -eu
if [ "$1" = "-c" ]; then
  printf '%s\\n' '{"pythonVersion":[3,10],"sdkVersion":"${PINNED_VERSION}","runtimeVersion":"${PINNED_VERSION}"}'
  exit 0
fi
if [ "$1" = "-m" ] && [ "$2" = "venv" ]; then
  target="$3"
  mkdir -p "$target/bin"
  cat > "$target/bin/python" <<'PYTHON_WRAPPER'
${managedPython}PYTHON_WRAPPER
  chmod 755 "$target/bin/python"
  exit 0
fi
exit 1
`,
    'utf8',
  );
  await chmod(executable, 0o755);
  return executable;
}

type ManagedInstallFixtureOptions = {
  readonly bootstrapResult?: Record<string, unknown>;
  readonly failVenv?: boolean;
  readonly failFirstPip?: boolean;
  readonly pipArgsPath?: string;
  readonly eventLogPath?: string;
  readonly failureMessage?: string;
  readonly includeGeneralEnvironmentValue?: boolean;
  readonly includeVersionEnvironmentValue?: boolean;
  readonly controlledWorkerId?: string;
  readonly bootstrapReleaseFile?: string;
  readonly pipReleaseFile?: string;
  readonly validationReleaseFile?: string;
  readonly pipMarkerFile?: string;
  readonly validationMarkerFile?: string;
};

async function createManagedInstallExecutable(
  root: string,
  options: ManagedInstallFixtureOptions = {},
  executablePath = path.join(root, 'managed-bootstrap.cjs'),
): Promise<string> {
  const configuration = {
    ...options,
    pipFailureStateFile: path.join(root, 'pip-failure-state'),
    pinnedVersion: PINNED_VERSION,
  };
  const createScript = (
    role: 'bootstrap' | 'managed',
    managedSource: string | undefined,
  ): string => `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const role = ${JSON.stringify(role)};
const config = ${JSON.stringify(configuration)};
const managedSource = ${JSON.stringify(managedSource)};
const workerId = process.env.DSH_TEST_WORKER_ID || 'single';
const waitBuffer = new Int32Array(new SharedArrayBuffer(4));
const args = process.argv.slice(2);

function appendEvent(event) {
  if (config.eventLogPath !== undefined) {
    fs.appendFileSync(config.eventLogPath, event + '\\n');
  }
}

function waitFor(file) {
  while (!fs.existsSync(file)) {
    Atomics.wait(waitBuffer, 0, 0, 10);
  }
}

function fail(message) {
  process.stderr.write(String(message) + '\\n');
  process.exit(1);
}

function acquireMarker(marker, phase) {
  if (marker === undefined) {
    return;
  }
  try {
    fs.writeFileSync(marker, workerId, { flag: 'wx' });
  } catch {
    appendEvent('conflict:' + phase + ':' + workerId);
    fail('concurrent ' + phase + ' execution');
  }
}

function releaseMarker(marker) {
  if (marker !== undefined) {
    fs.rmSync(marker, { force: true });
  }
}

function validResult() {
  return {
    pythonVersion: [3, 10],
    sdkVersion: config.pinnedVersion,
    runtimeVersion: config.pinnedVersion,
  };
}

function failureDiagnostic() {
  return [
    config.failureMessage,
    config.includeGeneralEnvironmentValue ? process.env.TAKT_TEST_GENERAL_VALUE : undefined,
    config.includeVersionEnvironmentValue ? process.env.TAKT_TEST_VERSION_VALUE : undefined,
  ].filter((value) => typeof value === 'string').join(' ');
}

if (args[0] === '-c') {
  if (role === 'bootstrap') {
    appendEvent('probe:' + workerId);
    if (config.controlledWorkerId === workerId && config.bootstrapReleaseFile !== undefined) {
      waitFor(config.bootstrapReleaseFile);
    }
    process.stdout.write(JSON.stringify(
      config.bootstrapResult === undefined ? validResult() : config.bootstrapResult,
    ) + '\\n');
    process.exit(0);
  }

  acquireMarker(config.validationMarkerFile, 'validation');
  appendEvent('validate:' + workerId);
  if (config.controlledWorkerId === workerId && config.validationReleaseFile !== undefined) {
    waitFor(config.validationReleaseFile);
  }
  releaseMarker(config.validationMarkerFile);
  process.stdout.write(JSON.stringify(validResult()) + '\\n');
  process.exit(0);
}

if (args[0] === '-m' && args[1] === 'venv') {
  if (config.failVenv) {
    fail('bootstrap Python is not supported');
  }
  const target = args[2];
  if (typeof target !== 'string' || managedSource === undefined) {
    fail('managed VENV target is missing');
  }
  fs.mkdirSync(path.join(target, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(target, 'bin', 'python'), managedSource, { mode: 0o755 });
  appendEvent('venv:' + workerId);
  process.exit(0);
}

if (args[0] === '-m' && args[1] === 'pip') {
  acquireMarker(config.pipMarkerFile, 'pip');
  appendEvent('pip:' + workerId);
  if (config.pipArgsPath !== undefined) {
    fs.appendFileSync(config.pipArgsPath, JSON.stringify(args) + '\\n');
  }
  if (config.failFirstPip && !fs.existsSync(config.pipFailureStateFile)) {
    fs.writeFileSync(config.pipFailureStateFile, 'failed');
    const venvRoot = path.resolve(path.dirname(process.argv[1]), '..');
    fs.writeFileSync(path.join(venvRoot, 'partial-marker'), 'partial VENV');
    releaseMarker(config.pipMarkerFile);
    process.stderr.write(failureDiagnostic() + '\\n');
    process.exit(1);
  }
  if (config.controlledWorkerId === workerId && config.pipReleaseFile !== undefined) {
    waitFor(config.pipReleaseFile);
  }
  releaseMarker(config.pipMarkerFile);
  process.exit(0);
}

fail('unexpected bootstrap Python invocation');
`;

  const managedSource = createScript('managed', undefined);
  await writeFile(executablePath, createScript('bootstrap', managedSource), 'utf8');
  await chmod(executablePath, 0o755);
  return executablePath;
}

const installWorkerFixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'deepseek-harness-managed-install.ts',
);
const viteNodePath = path.join(process.cwd(), 'node_modules', 'vite-node', 'vite-node.mjs');

type InstallWorkerHandle = {
  readonly child: ChildProcess;
  readonly completion: Promise<string>;
};

function startInstallWorker(
  configDir: string,
  pythonPath: string,
  workerId: string,
  controlDir: string,
): InstallWorkerHandle {
  const child = spawn(process.execPath, [
    viteNodePath,
    installWorkerFixturePath,
    configDir,
    pythonPath,
    workerId,
  ], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DSH_TEST_CONTROL_DIR: controlDir,
      DSH_TEST_WORKER_ID: workerId,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const completion = new Promise<string>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(
        `DeepSeek Harness install worker ${workerId} exited with ${String(code)}${
          signal === null ? '' : ` (${signal})`
        }: ${stderr}`,
      ));
    });
  });
  return { child, completion };
}

async function readEventLog(logPath: string): Promise<readonly string[]> {
  try {
    const content = await readFile(logPath, 'utf8');
    return content.split(/\r?\n/u).filter((event) => event.length > 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function waitForFile(filePath: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await readFile(filePath);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}

async function waitForEvent(logPath: string, event: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await readEventLog(logPath)).includes(event)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for event ${event}`);
}

async function waitForAnyEvent(
  logPath: string,
  events: readonly string[],
  timeoutMs = 10_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const observed = await readEventLog(logPath);
    const event = events.find((candidate) => observed.includes(candidate));
    if (event !== undefined) {
      return event;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for one of ${events.join(', ')}`);
}

async function expectNoWorkerActivity(
  logPath: string,
  workerId: string,
  observationMs = 500,
): Promise<void> {
  const deadline = Date.now() + observationMs;
  while (Date.now() < deadline) {
    const activity = (await readEventLog(logPath)).some((event) => event.endsWith(`:${workerId}`));
    expect(activity).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

type ValidateOptionsWithProbeTimeout = NonNullable<
  Parameters<typeof validateDeepSeekHarnessInstallation>[1]
> & {
  readonly probeTimeoutMs: number;
};

describe('DeepSeek Harness constructor arguments', () => {
  it('returns only the required constructor arguments by default', () => {
    expect(getDeepSeekHarnessConstructorArguments({})).toEqual([
      'provider',
      'model',
      'cwd',
      'runtime_cwd',
      'request_timeout_seconds',
      'shutdown_timeout_seconds',
    ]);
  });

  it.each([
    ['maxTokens', { maxTokens: 256 }, 'max_tokens'],
    ['sessionRoot', { sessionRoot: '/tmp/deepseek-sessions' }, 'session_root'],
    ['cordis', { cordis: 'cordis-profile' }, 'cordis'],
  ] as const)('maps configured %s to its constructor argument', (_name, configuration, expectedArgument) => {
    expect(getDeepSeekHarnessConstructorArguments(configuration)).toEqual([
      'provider',
      'model',
      'cwd',
      'runtime_cwd',
      'request_timeout_seconds',
      'shutdown_timeout_seconds',
      expectedArgument,
    ]);
  });

  it('appends configured optional arguments in their defined order', () => {
    expect(getDeepSeekHarnessConstructorArguments({
      cordis: 'cordis-profile',
      sessionRoot: '/tmp/deepseek-sessions',
      maxTokens: 256,
    })).toEqual([
      'provider',
      'model',
      'cwd',
      'runtime_cwd',
      'request_timeout_seconds',
      'shutdown_timeout_seconds',
      'max_tokens',
      'session_root',
      'cordis',
    ]);
  });
});

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe.skipIf(process.platform === 'win32')('DeepSeek Harness managed VENV', () => {
  it('validates the pinned package pair and constructor before use', async () => {
    const root = await createTemporaryRoot();
    const pythonPath = await createProbeExecutable(root, {
      pythonVersion: [3, 10],
      sdkVersion: PINNED_VERSION,
      runtimeVersion: PINNED_VERSION,
    });

    const installation = await validateDeepSeekHarnessInstallation(pythonPath);

    expect(installation).toEqual({
      pythonPath,
      pythonVersion: '3.10',
      sdkVersion: PINNED_VERSION,
      runtimeVersion: PINNED_VERSION,
    });
  });

  it('fails a hanging environment probe within the configured timeout', async () => {
    const root = await createTemporaryRoot();
    const pythonPath = await createHangingProbeExecutable(root);
    const startedAt = Date.now();
    const options: ValidateOptionsWithProbeTimeout = { probeTimeoutMs: 100 };

    await expect(validateDeepSeekHarnessInstallation(pythonPath, options)).rejects.toThrow();
    expect(Date.now() - startedAt).toBeLessThan(5_000);
  });

  it.each([
    [
      'Python below minimum',
      { pythonVersion: [3, 9], sdkVersion: PINNED_VERSION, runtimeVersion: PINNED_VERSION },
      /Python 3\.10 or newer/iu,
    ],
    [
      'missing SDK',
      { pythonVersion: [3, 10], sdkVersion: null, runtimeVersion: PINNED_VERSION },
      /missing deepseek-harness-sdk/iu,
    ],
    [
      'missing runtime',
      { pythonVersion: [3, 10], sdkVersion: PINNED_VERSION, runtimeVersion: null },
      /missing deepseek-harness-runtime-bin/iu,
    ],
    [
      'mismatched pair',
      { pythonVersion: [3, 10], sdkVersion: PINNED_VERSION, runtimeVersion: '0.1.0' },
      /version mismatch/iu,
    ],
    [
      'unpinned pair',
      { pythonVersion: [3, 10], sdkVersion: '0.1.0', runtimeVersion: '0.1.0' },
      /not the pinned version/iu,
    ],
    [
      'unsupported constructor',
      {
        pythonVersion: [3, 10],
        sdkVersion: PINNED_VERSION,
        runtimeVersion: PINNED_VERSION,
        unsupportedConstructorArguments: ['runtime_cwd'],
      },
      /constructor does not support/iu,
    ],
  ] as const)('rejects %s before a bridge can use the environment', async (_name, result, expectedError) => {
    const root = await createTemporaryRoot();
    const pythonPath = await createProbeExecutable(root, result);

    await expect(validateDeepSeekHarnessInstallation(pythonPath)).rejects.toThrow(expectedError);
  });

  it('recreates a partial VENV and validates the pinned pair on retry after pip fails', async () => {
    const configDir = await createTemporaryRoot();
    const paths = resolveDeepSeekHarnessManagedPaths(configDir);
    const pipArgsPath = path.join(configDir, 'retry-pip-args.jsonl');
    const bootstrapPython = await createManagedInstallExecutable(configDir, {
      failFirstPip: true,
      pipArgsPath,
    });

    await expect(installManagedDeepSeekHarness({
      configDir,
      pythonPath: bootstrapPython,
    })).rejects.toThrow();
    expect(await readFile(path.join(paths.venvPath, 'partial-marker'), 'utf8')).toBe('partial VENV');

    const installation = await installManagedDeepSeekHarness({
      configDir,
      pythonPath: bootstrapPython,
    });

    await expect(readFile(path.join(paths.venvPath, 'partial-marker'), 'utf8'))
      .rejects.toMatchObject({ code: 'ENOENT' });
    expect(installation).toMatchObject({
      pythonPath: paths.pythonPath,
      venvPath: paths.venvPath,
      dshHomePath: paths.dshHomePath,
      pythonVersion: '3.10',
      sdkVersion: PINNED_VERSION,
      runtimeVersion: PINNED_VERSION,
    });
    const pipInvocations = (await readFile(pipArgsPath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as string[]);
    const expectedPinnedPipArguments = [
      '-m',
      'pip',
      'install',
      '--disable-pip-version-check',
      '--no-input',
      `deepseek-harness-sdk==${PINNED_VERSION}`,
      `deepseek-harness-runtime-bin==${PINNED_VERSION}`,
    ];
    expect(pipInvocations).toHaveLength(2);
    expect(pipInvocations[0]).toEqual(expectedPinnedPipArguments);
    expect(pipInvocations[1]).toEqual(expectedPinnedPipArguments);
  });

  it('preserves DSH_HOME profiles and plugins across a failed install and retry', async () => {
    const configDir = await createTemporaryRoot();
    const paths = resolveDeepSeekHarnessManagedPaths(configDir);
    const profilePath = path.join(paths.dshHomePath, 'profiles', 'default.yml');
    const pluginPath = path.join(paths.dshHomePath, 'plugins', 'installed.txt');
    await mkdir(path.dirname(profilePath), { recursive: true });
    await mkdir(path.dirname(pluginPath), { recursive: true });
    await writeFile(profilePath, 'profile', 'utf8');
    await writeFile(pluginPath, 'plugin', 'utf8');
    const bootstrapPython = await createManagedInstallExecutable(configDir, { failFirstPip: true });

    await expect(installManagedDeepSeekHarness({
      configDir,
      pythonPath: bootstrapPython,
    })).rejects.toThrow();
    expect(await readFile(profilePath, 'utf8')).toBe('profile');
    expect(await readFile(pluginPath, 'utf8')).toBe('plugin');

    await installManagedDeepSeekHarness({
      configDir,
      pythonPath: bootstrapPython,
    });

    expect(await readFile(profilePath, 'utf8')).toBe('profile');
    expect(await readFile(pluginPath, 'utf8')).toBe('plugin');
  });

  it('does not remove an existing VENV when the bootstrap Python is invalid', async () => {
    const configDir = await createTemporaryRoot();
    const paths = resolveDeepSeekHarnessManagedPaths(configDir);
    const existingMarker = path.join(paths.venvPath, 'existing-marker');
    await mkdir(paths.venvPath, { recursive: true });
    await writeFile(existingMarker, 'existing environment', 'utf8');
    const bootstrapPython = await createManagedInstallExecutable(configDir, {
      bootstrapResult: { pythonVersion: [3, 9] },
      failVenv: true,
    });

    await expect(installManagedDeepSeekHarness({
      configDir,
      pythonPath: bootstrapPython,
    })).rejects.toThrow();

    expect(await readFile(existingMarker, 'utf8')).toBe('existing environment');
  });

  it('does not remove an existing VENV when the default bootstrap Python is invalid', async () => {
    const configDir = await createTemporaryRoot();
    const paths = resolveDeepSeekHarnessManagedPaths(configDir);
    const existingMarker = path.join(paths.venvPath, 'existing-marker');
    const bootstrapDir = path.join(configDir, 'bootstrap-bin');
    const bootstrapPython = path.join(bootstrapDir, 'python3');
    await mkdir(paths.venvPath, { recursive: true });
    await writeFile(existingMarker, 'existing environment', 'utf8');
    await mkdir(bootstrapDir, { recursive: true });
    await createManagedInstallExecutable(configDir, {
      bootstrapResult: { pythonVersion: [3, 9] },
      failVenv: true,
    }, bootstrapPython);

    const previousPath = process.env.PATH;
    process.env.PATH = previousPath === undefined
      ? bootstrapDir
      : `${bootstrapDir}${path.delimiter}${previousPath}`;
    try {
      await expect(installManagedDeepSeekHarness({ configDir })).rejects.toThrow();
      expect(await readFile(existingMarker, 'utf8')).toBe('existing environment');
    } finally {
      if (previousPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = previousPath;
      }
    }
  });

  it('redacts only DeepSeek secret environment values from installation errors', async () => {
    const configDir = await createTemporaryRoot();
    const apiKey = 'deepseek-managed-api-secret-123456';
    const baseUrl = 'https://deepseek-managed-secret.example/v1';
    const generalValue = 'ordinary-installation-environment-value';
    const versionValue = PINNED_VERSION;
    const previousValues = {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: process.env.DEEPSEEK_BASE_URL,
      general: process.env.TAKT_TEST_GENERAL_VALUE,
      version: process.env.TAKT_TEST_VERSION_VALUE,
    };
    process.env.DEEPSEEK_API_KEY = apiKey;
    process.env.DEEPSEEK_BASE_URL = baseUrl;
    process.env.TAKT_TEST_GENERAL_VALUE = generalValue;
    process.env.TAKT_TEST_VERSION_VALUE = versionValue;
    try {
      const bootstrapPython = await createManagedInstallExecutable(configDir, {
        failFirstPip: true,
        failureMessage: `${apiKey} ${baseUrl}`,
        includeGeneralEnvironmentValue: true,
        includeVersionEnvironmentValue: true,
      });

      let failure: unknown;
      try {
        await installManagedDeepSeekHarness({
          configDir,
          pythonPath: bootstrapPython,
        });
      } catch (error) {
        failure = error;
      }
      if (!(failure instanceof Error)) {
        throw new Error('Expected managed DeepSeek Harness installation to fail');
      }

      expect(failure.message).not.toContain(apiKey);
      expect(failure.message).not.toContain(baseUrl);
      expect(failure.message).toContain('[REDACTED]');
      expect(failure.message).toContain(generalValue);
      expect(failure.message).toContain(versionValue);
    } finally {
      if (previousValues.apiKey === undefined) {
        delete process.env.DEEPSEEK_API_KEY;
      } else {
        process.env.DEEPSEEK_API_KEY = previousValues.apiKey;
      }
      if (previousValues.baseUrl === undefined) {
        delete process.env.DEEPSEEK_BASE_URL;
      } else {
        process.env.DEEPSEEK_BASE_URL = previousValues.baseUrl;
      }
      if (previousValues.general === undefined) {
        delete process.env.TAKT_TEST_GENERAL_VALUE;
      } else {
        process.env.TAKT_TEST_GENERAL_VALUE = previousValues.general;
      }
      if (previousValues.version === undefined) {
        delete process.env.TAKT_TEST_VERSION_VALUE;
      } else {
        process.env.TAKT_TEST_VERSION_VALUE = previousValues.version;
      }
    }
  });

  it('serializes concurrent installs through final validation for one managed root', async () => {
    const configDir = await createTemporaryRoot();
    const controlDir = path.join(configDir, 'control');
    await mkdir(controlDir, { recursive: true });
    const eventLogPath = path.join(controlDir, 'events.log');
    const bootstrapReleaseFile = path.join(controlDir, 'release-bootstrap');
    const pipReleaseFile = path.join(controlDir, 'release-pip');
    const validationReleaseFile = path.join(controlDir, 'release-validation');
    const pipMarkerFile = path.join(controlDir, 'pip-active');
    const validationMarkerFile = path.join(controlDir, 'validation-active');
    const bootstrapPython = await createManagedInstallExecutable(configDir, {
      eventLogPath,
      controlledWorkerId: 'one',
      bootstrapReleaseFile,
      pipReleaseFile,
      validationReleaseFile,
      pipMarkerFile,
      validationMarkerFile,
    });
    const first = startInstallWorker(configDir, bootstrapPython, 'one', controlDir);
    let second: InstallWorkerHandle | undefined;
    try {
      await waitForAnyEvent(eventLogPath, ['probe:one', 'venv:one']);
      second = startInstallWorker(configDir, bootstrapPython, 'two', controlDir);
      await waitForFile(path.join(controlDir, 'ready-two'));
      await expectNoWorkerActivity(eventLogPath, 'two');
      await writeFile(bootstrapReleaseFile, 'release', 'utf8');

      await waitForEvent(eventLogPath, 'pip:one');
      await expectNoWorkerActivity(eventLogPath, 'two');
      await writeFile(pipReleaseFile, 'release', 'utf8');

      await waitForEvent(eventLogPath, 'validate:one');
      await expectNoWorkerActivity(eventLogPath, 'two');
      await writeFile(validationReleaseFile, 'release', 'utf8');

      const outputs = await Promise.all([
        first.completion,
        second.completion,
      ]);
      const installations = outputs.map((output) => JSON.parse(output.trim()) as Record<string, unknown>);
      expect(installations).toHaveLength(2);
      for (const installation of installations) {
        expect(installation).toMatchObject({
          pythonVersion: '3.10',
          sdkVersion: PINNED_VERSION,
          runtimeVersion: PINNED_VERSION,
        });
      }
      expect((await readEventLog(eventLogPath)).some((event) => event.startsWith('conflict:'))).toBe(false);
    } finally {
      await Promise.all([
        writeFile(bootstrapReleaseFile, 'release', 'utf8'),
        writeFile(pipReleaseFile, 'release', 'utf8'),
        writeFile(validationReleaseFile, 'release', 'utf8'),
      ]);
      for (const worker of [first, second]) {
        if (worker !== undefined && worker.child.exitCode === null && worker.child.signalCode === null) {
          worker.child.kill('SIGKILL');
        }
      }
      await Promise.allSettled([
        first.completion,
        ...(second === undefined ? [] : [second.completion]),
      ]);
    }
  }, 20_000);

  it('recreates only the VENV, installs exact requirements, and preserves DSH_HOME', async () => {
    const configDir = await createTemporaryRoot();
    const paths = resolveDeepSeekHarnessManagedPaths(configDir);
    await mkdir(paths.venvPath, { recursive: true });
    await writeFile(path.join(paths.venvPath, 'old-marker'), 'old environment', 'utf8');
    await mkdir(path.join(paths.dshHomePath, 'profiles'), { recursive: true });
    await mkdir(path.join(paths.dshHomePath, 'plugins'), { recursive: true });
    await writeFile(path.join(paths.dshHomePath, 'profiles', 'default.yml'), 'profile', 'utf8');
    await writeFile(path.join(paths.dshHomePath, 'plugins', 'installed.txt'), 'plugin', 'utf8');

    const pipArgsPath = path.join(configDir, 'pip-args.txt');
    const bootstrapPython = await createBootstrapExecutable(configDir, pipArgsPath);
    const installation = await installManagedDeepSeekHarness({
      configDir,
      pythonPath: bootstrapPython,
    });

    await expect(readFile(path.join(paths.venvPath, 'old-marker'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(path.join(paths.dshHomePath, 'profiles', 'default.yml'), 'utf8')).toBe('profile');
    expect(await readFile(path.join(paths.dshHomePath, 'plugins', 'installed.txt'), 'utf8')).toBe('plugin');
    expect(installation).toMatchObject({
      venvPath: paths.venvPath,
      dshHomePath: paths.dshHomePath,
      sdkVersion: PINNED_VERSION,
      runtimeVersion: PINNED_VERSION,
    });

    const pipArgs = (await readFile(pipArgsPath, 'utf8')).trim().split('\n');
    expect(pipArgs).toEqual(expect.arrayContaining([
      '-m',
      'pip',
      'install',
      `deepseek-harness-sdk==${PINNED_VERSION}`,
      `deepseek-harness-runtime-bin==${PINNED_VERSION}`,
    ]));
  });
});
