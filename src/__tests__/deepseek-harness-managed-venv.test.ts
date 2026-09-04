import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
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
