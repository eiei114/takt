import { execFile } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { getGlobalConfigDir } from '../config/paths.js';
import { sanitizeTerminalText } from '../../shared/utils/text.js';
import {
  DEEPSEEK_HARNESS_HOME_ENV_NAME,
  DEEPSEEK_HARNESS_PINNED_VERSION,
  DEEPSEEK_HARNESS_RUNTIME_PACKAGE,
  DEEPSEEK_HARNESS_SDK_PACKAGE,
} from './constants.js';

const execFileAsync = promisify(execFile);
const DEEPSEEK_HARNESS_ENVIRONMENT_DIR = 'deepseek-harness';
const DEEPSEEK_HARNESS_VENV_DIR = 'venv';
const DEEPSEEK_HARNESS_HOME_DIR = 'dsh-home';
const DEEPSEEK_HARNESS_PROBE_TIMEOUT_MS = 30_000;
const DEEPSEEK_HARNESS_COMMAND_TIMEOUT_MS = 15 * 60 * 1_000;
const DEEPSEEK_HARNESS_MAX_COMMAND_OUTPUT_BYTES = 128 * 1024;
const DEEPSEEK_HARNESS_REQUIRED_CONSTRUCTOR_ARGUMENTS = [
  'provider',
  'model',
  'cwd',
  'runtime_cwd',
  'request_timeout_seconds',
  'shutdown_timeout_seconds',
] as const;

const DEEPSEEK_HARNESS_PROBE_SCRIPT = `
import importlib.metadata
import inspect
import json
import sys


def installed_version(distribution_name):
    try:
        return importlib.metadata.version(distribution_name)
    except importlib.metadata.PackageNotFoundError:
        return None


result = {
    "pythonVersion": [sys.version_info.major, sys.version_info.minor],
    "sdkVersion": installed_version(${JSON.stringify(DEEPSEEK_HARNESS_SDK_PACKAGE)}),
    "runtimeVersion": installed_version(${JSON.stringify(DEEPSEEK_HARNESS_RUNTIME_PACKAGE)}),
}
try:
    from deepseek_harness import DeepSeekHarness
except BaseException as error:
    result["sdkImportError"] = str(error)
else:
    constructor_arguments = sys.argv[1:]
    try:
        from deepseek_harness import DeepSeekHarnessConfig
    except ImportError:
        constructor_targets = [DeepSeekHarness]
    else:
        constructor_targets = [DeepSeekHarness, DeepSeekHarnessConfig]

    unsupported = []
    constructor_errors = []
    for constructor_target in constructor_targets:
        try:
            signature = inspect.signature(constructor_target)
            parameters = signature.parameters
            accepts_arbitrary_keywords = any(
                parameter.kind is inspect.Parameter.VAR_KEYWORD
                for parameter in parameters.values()
            )
            unsupported.extend(
                argument for argument in constructor_arguments
                if argument not in parameters and not accepts_arbitrary_keywords
            )
            signature.bind(**{argument: object() for argument in constructor_arguments})
        except TypeError as error:
            constructor_errors.append(str(error))
        except (ValueError, RuntimeError) as error:
            constructor_errors.append(str(error))

    unique_unsupported = list(dict.fromkeys(unsupported))
    if unique_unsupported:
        result["unsupportedConstructorArguments"] = unique_unsupported
    elif constructor_errors:
        result["constructorError"] = constructor_errors[0]

print(json.dumps(result, separators=(",", ":")))
`;

interface DeepSeekHarnessProbeResult {
  pythonVersion?: unknown;
  sdkVersion?: unknown;
  runtimeVersion?: unknown;
  sdkImportError?: unknown;
  unsupportedConstructorArguments?: unknown;
  constructorError?: unknown;
}

export interface DeepSeekHarnessManagedPaths {
  readonly rootPath: string;
  readonly venvPath: string;
  readonly pythonPath: string;
  readonly dshHomePath: string;
}

export interface DeepSeekHarnessInstallation {
  readonly pythonPath: string;
  readonly pythonVersion: string;
  readonly sdkVersion: string;
  readonly runtimeVersion: string;
}

export interface ManagedDeepSeekHarnessInstallation extends DeepSeekHarnessInstallation {
  readonly venvPath: string;
  readonly dshHomePath: string;
}

export interface ValidateDeepSeekHarnessInstallationOptions {
  readonly constructorArguments?: readonly string[];
  readonly environment?: NodeJS.ProcessEnv;
  readonly abortSignal?: AbortSignal;
}

export interface InstallManagedDeepSeekHarnessOptions {
  readonly pythonPath?: string;
  readonly configDir?: string;
}

interface CommandError extends Error {
  stderr?: unknown;
}

export function resolveDeepSeekHarnessManagedPaths(
  configDir = getGlobalConfigDir(),
): DeepSeekHarnessManagedPaths {
  const rootPath = join(resolve(configDir), DEEPSEEK_HARNESS_ENVIRONMENT_DIR);
  const venvPath = join(rootPath, DEEPSEEK_HARNESS_VENV_DIR);
  const pythonPath = process.platform === 'win32'
    ? join(venvPath, 'Scripts', 'python.exe')
    : join(venvPath, 'bin', 'python');
  return {
    rootPath,
    venvPath,
    pythonPath,
    dshHomePath: join(rootPath, DEEPSEEK_HARNESS_HOME_DIR),
  };
}

function defaultBootstrapPythonPath(): string {
  return process.platform === 'win32' ? 'python' : 'python3';
}

function resolveBootstrapPythonPath(pythonPath: string | undefined): string {
  if (pythonPath === undefined) {
    return defaultBootstrapPythonPath();
  }
  const trimmed = pythonPath.trim();
  if (trimmed.length === 0) {
    throw new Error('DeepSeek Harness bootstrap Python path must not be empty');
  }
  return trimmed;
}

function commandErrorMessage(
  error: unknown,
  environment: NodeJS.ProcessEnv,
): string {
  const message = error instanceof Error
    ? (() => {
        const commandError = error as CommandError;
        const stderr = typeof commandError.stderr === 'string' ? commandError.stderr.trim() : '';
        return stderr.length > 0 ? stderr : error.message;
      })()
    : String(error);
  let sanitized = sanitizeTerminalText(message);
  for (const value of Object.values(environment)
    .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0)
    .sort((left, right) => right.length - left.length)) {
    sanitized = sanitized.split(value).join('[REDACTED]');
  }
  return sanitized;
}

async function runPythonCommand(
  pythonPath: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
  timeout: number,
  operation: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  try {
    const result = await execFileAsync(pythonPath, [...args], {
      env: environment,
      encoding: 'utf8',
      timeout,
      maxBuffer: DEEPSEEK_HARNESS_MAX_COMMAND_OUTPUT_BYTES,
      signal: abortSignal,
    });
    return result.stdout;
  } catch (error) {
    throw new Error(
      `Unable to ${operation} for DeepSeek Harness with Python "${pythonPath}": ${commandErrorMessage(error, environment)}`,
      { cause: error },
    );
  }
}

function parseProbeResult(stdout: string, pythonPath: string): DeepSeekHarnessProbeResult {
  const lines = stdout.trim().split(/\r?\n/u).filter((line) => line.length > 0);
  const lastLine = lines.at(-1);
  if (lastLine === undefined) {
    throw new Error(`DeepSeek Harness Python environment probe returned no result for "${pythonPath}"`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(lastLine) as unknown;
  } catch (error) {
    throw new Error(
      `DeepSeek Harness Python environment probe returned malformed output for "${pythonPath}"`,
      { cause: error },
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`DeepSeek Harness Python environment probe returned an invalid result for "${pythonPath}"`);
  }
  return parsed as DeepSeekHarnessProbeResult;
}

interface PythonVersion {
  readonly text: string;
  readonly major: number;
  readonly minor: number;
}

function parsePythonVersion(value: unknown, pythonPath: string): PythonVersion {
  if (
    !Array.isArray(value)
    || value.length < 2
    || !Number.isInteger(value[0])
    || !Number.isInteger(value[1])
  ) {
    throw new Error(`DeepSeek Harness Python environment probe returned an invalid Python version for "${pythonPath}"`);
  }
  const major = value[0] as number;
  const minor = value[1] as number;
  return { text: `${major}.${minor}`, major, minor };
}

function parsePackageVersion(value: unknown, packageName: string, pythonPath: string): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `DeepSeek Harness Python environment probe returned an invalid ${packageName} version for "${pythonPath}"`,
    );
  }
  return value;
}

function requireProbeError(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.length === 0) {
    return `${label} was reported without a diagnostic`;
  }
  return value;
}

function constructorArguments(
  requestedArguments: readonly string[] | undefined,
): readonly string[] {
  return requestedArguments ?? DEEPSEEK_HARNESS_REQUIRED_CONSTRUCTOR_ARGUMENTS;
}

function createProbeEnvironment(environment: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  return environment === undefined ? { ...process.env } : { ...environment };
}

export async function validateDeepSeekHarnessInstallation(
  pythonPath: string,
  options?: ValidateDeepSeekHarnessInstallationOptions,
): Promise<DeepSeekHarnessInstallation> {
  const trimmedPythonPath = pythonPath.trim();
  if (trimmedPythonPath.length === 0) {
    throw new Error('DeepSeek Harness Python path must not be empty');
  }
  let probe: string;
  try {
    probe = await runPythonCommand(
      trimmedPythonPath,
      ['-c', DEEPSEEK_HARNESS_PROBE_SCRIPT, ...constructorArguments(options?.constructorArguments)],
      createProbeEnvironment(options?.environment),
      DEEPSEEK_HARNESS_PROBE_TIMEOUT_MS,
      'inspect the Python environment',
      options?.abortSignal,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message} Run \`takt deepseek-harness install\` to create the managed environment, `
      + 'or set a valid provider_options.deepseek_harness.python_path.',
      { cause: error },
    );
  }
  const result = parseProbeResult(probe, trimmedPythonPath);
  const parsedPythonVersion = parsePythonVersion(result.pythonVersion, trimmedPythonPath);
  if (parsedPythonVersion.major < 3 || (parsedPythonVersion.major === 3 && parsedPythonVersion.minor < 10)) {
    throw new Error(
      `DeepSeek Harness requires Python 3.10 or newer; Python ${parsedPythonVersion.text} was found at "${trimmedPythonPath}"`,
    );
  }

  const sdkVersion = parsePackageVersion(result.sdkVersion, DEEPSEEK_HARNESS_SDK_PACKAGE, trimmedPythonPath);
  const runtimeVersion = parsePackageVersion(
    result.runtimeVersion,
    DEEPSEEK_HARNESS_RUNTIME_PACKAGE,
    trimmedPythonPath,
  );
  if (sdkVersion === undefined || runtimeVersion === undefined) {
    const missingPackages = [
      sdkVersion === undefined ? DEEPSEEK_HARNESS_SDK_PACKAGE : undefined,
      runtimeVersion === undefined ? DEEPSEEK_HARNESS_RUNTIME_PACKAGE : undefined,
    ].filter((packageName): packageName is string => packageName !== undefined);
    throw new Error(
      `DeepSeek Harness Python environment at "${trimmedPythonPath}" is missing ${missingPackages.join(' and ')}. `
      + `Run \`takt deepseek-harness install\` or install the pinned ${DEEPSEEK_HARNESS_SDK_PACKAGE} `
      + `and ${DEEPSEEK_HARNESS_RUNTIME_PACKAGE} packages in this environment.`,
    );
  }

  if (sdkVersion !== runtimeVersion) {
    throw new Error(
      `DeepSeek Harness SDK/runtime version mismatch in "${trimmedPythonPath}": `
      + `${DEEPSEEK_HARNESS_SDK_PACKAGE}=${sdkVersion}, `
      + `${DEEPSEEK_HARNESS_RUNTIME_PACKAGE}=${runtimeVersion}; both must match ${DEEPSEEK_HARNESS_PINNED_VERSION}.`,
    );
  }
  if (sdkVersion !== DEEPSEEK_HARNESS_PINNED_VERSION) {
    throw new Error(
      `DeepSeek Harness SDK/runtime version ${sdkVersion} in "${trimmedPythonPath}" is not the pinned `
      + `version ${DEEPSEEK_HARNESS_PINNED_VERSION}. `
      + `Install ${DEEPSEEK_HARNESS_SDK_PACKAGE}==${DEEPSEEK_HARNESS_PINNED_VERSION} and `
      + `${DEEPSEEK_HARNESS_RUNTIME_PACKAGE}==${DEEPSEEK_HARNESS_PINNED_VERSION}.`,
    );
  }

  const sdkImportError = requireProbeError(result.sdkImportError, 'DeepSeek Harness SDK import');
  if (sdkImportError !== undefined) {
    throw new Error(
      `DeepSeek Harness SDK cannot be imported from "${trimmedPythonPath}": ${sdkImportError}`,
    );
  }
  const unsupported = result.unsupportedConstructorArguments;
  if (unsupported !== undefined) {
    if (!Array.isArray(unsupported) || !unsupported.every((value): value is string => typeof value === 'string')) {
      throw new Error(
        `DeepSeek Harness Python environment probe returned invalid constructor compatibility data for "${trimmedPythonPath}"`,
      );
    }
    if (unsupported.length > 0) {
      throw new Error(
        `DeepSeek Harness SDK constructor does not support: ${unsupported.join(', ')}`,
      );
    }
  }
  const constructorError = requireProbeError(result.constructorError, 'DeepSeek Harness SDK constructor');
  if (constructorError !== undefined) {
    throw new Error(
      `DeepSeek Harness SDK constructor does not support the bridge configuration: ${constructorError}`,
    );
  }

  return {
    pythonPath: trimmedPythonPath,
    pythonVersion: parsedPythonVersion.text,
    sdkVersion,
    runtimeVersion,
  };
}

function createInstallationEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  delete environment.DEEPSEEK_API_KEY;
  delete environment.DEEPSEEK_BASE_URL;
  delete environment[DEEPSEEK_HARNESS_HOME_ENV_NAME];
  return environment;
}

export async function installManagedDeepSeekHarness(
  options: InstallManagedDeepSeekHarnessOptions = {},
): Promise<ManagedDeepSeekHarnessInstallation> {
  const paths = resolveDeepSeekHarnessManagedPaths(options.configDir);
  const bootstrapPythonPath = resolveBootstrapPythonPath(options.pythonPath);
  const environment = {
    ...createInstallationEnvironment(),
    [DEEPSEEK_HARNESS_HOME_ENV_NAME]: paths.dshHomePath,
  };

  await mkdir(paths.rootPath, { recursive: true });
  await rm(paths.venvPath, { recursive: true, force: true });
  await runPythonCommand(
    bootstrapPythonPath,
    ['-m', 'venv', paths.venvPath],
    environment,
    DEEPSEEK_HARNESS_COMMAND_TIMEOUT_MS,
    'create the managed virtual environment',
  );
  await mkdir(paths.dshHomePath, { recursive: true });
  await runPythonCommand(
    paths.pythonPath,
    [
      '-m',
      'pip',
      'install',
      '--disable-pip-version-check',
      '--no-input',
      `${DEEPSEEK_HARNESS_SDK_PACKAGE}==${DEEPSEEK_HARNESS_PINNED_VERSION}`,
      `${DEEPSEEK_HARNESS_RUNTIME_PACKAGE}==${DEEPSEEK_HARNESS_PINNED_VERSION}`,
    ],
    environment,
    DEEPSEEK_HARNESS_COMMAND_TIMEOUT_MS,
    'install the pinned SDK/runtime pair',
  );
  const installation = await validateDeepSeekHarnessInstallation(paths.pythonPath, {
    environment,
  });
  return {
    ...installation,
    venvPath: paths.venvPath,
    dshHomePath: paths.dshHomePath,
  };
}

export function getDeepSeekHarnessConstructorArguments(
  configuration: Readonly<{
    maxTokens?: number;
    sessionRoot?: string;
    cordis?: string;
  }>,
): readonly string[] {
  const argumentsToValidate: string[] = [...DEEPSEEK_HARNESS_REQUIRED_CONSTRUCTOR_ARGUMENTS];
  if (configuration.maxTokens !== undefined) {
    argumentsToValidate.push('max_tokens');
  }
  if (configuration.sessionRoot !== undefined) {
    argumentsToValidate.push('session_root');
  }
  if (configuration.cordis !== undefined) {
    argumentsToValidate.push('cordis');
  }
  return argumentsToValidate;
}
