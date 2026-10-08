import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type PackageJson = {
  dependencies?: Record<string, string>;
  engines?: Record<string, string>;
};

type LockedPackage = {
  version?: string;
  engines?: Record<string, string>;
  resolved?: string;
  integrity?: string;
  peerDependencies?: Record<string, string>;
};

type PackageLock = {
  packages?: Record<string, LockedPackage>;
};

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as PackageJson;
}

function readPackageLock(): PackageLock {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'package-lock.json'), 'utf-8'),
  ) as PackageLock;
}

function getLockedPackage(packageLock: PackageLock, path: string): LockedPackage {
  const lockedPackage = packageLock.packages?.[path];
  if (!lockedPackage) {
    throw new Error(`${path} is not present in package-lock.json`);
  }
  return lockedPackage;
}

function getNpmCliPath(): string {
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) {
    throw new Error('npm_execpath is required to run the lockfile regression fixture');
  }
  return resolve(process.cwd(), npmExecPath);
}

// The failing CI job used Node 22.22.0, which reports npm 10.9.4.
const LOCKFILE_VALIDATION_NPM_VERSION = '10.9.4';

function getNpmVersion(npmCli: string): string {
  return execFileSync(
    process.execPath,
    [
      npmCli,
      'exec',
      '--yes',
      `--package=npm@${LOCKFILE_VALIDATION_NPM_VERSION}`,
      '--',
      'npm',
      '--version',
    ],
    { encoding: 'utf-8' },
  ).trim();
}

function runNpmCi(
  packageLock: PackageLock,
  npmCli: string,
): { status: number; output: string } {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), 'takt-lockfile-regression-'));
  try {
    copyFileSync(join(process.cwd(), 'package.json'), join(fixtureDirectory, 'package.json'));
    writeFileSync(
      join(fixtureDirectory, 'package-lock.json'),
      JSON.stringify(packageLock),
    );

    const runNpmCiScript = [
      "const { spawnSync } = require('node:child_process');",
      "const result = spawnSync('npm', ['ci', '--dry-run'], { cwd: process.argv[1], encoding: 'utf-8' });",
      'if (result.error) throw result.error;',
      "process.stdout.write(result.stdout ?? '');",
      "process.stderr.write(result.stderr ?? '');",
      'process.exitCode = result.status ?? 1;',
    ].join('\n');
    const result = spawnSync(
      process.execPath,
      [
        npmCli,
        'exec',
        '--yes',
        `--package=npm@${LOCKFILE_VALIDATION_NPM_VERSION}`,
        '--',
        'node',
        '-e',
        runNpmCiScript,
        fixtureDirectory,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf-8',
        env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' },
        timeout: 120_000,
      },
    );
    if (result.error) {
      throw result.error;
    }
    if (result.status === null) {
      throw new Error(`npm ci did not exit: ${result.stderr}`);
    }
    return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
}

type NodeVersion = readonly [number, number, number];

function parseNodeVersion(version: string): NodeVersion {
  const normalized = version.replace(/^[vV]/, '');
  const parts = normalized.split('.');
  if (parts.length > 3 || parts.length === 0) {
    throw new Error(`Unsupported Node version: ${version}`);
  }

  return [parseVersionPart(parts[0]), parseVersionPart(parts[1]), parseVersionPart(parts[2])];
}

function parseVersionPart(part: string | undefined): number {
  if (part === undefined) {
    return 0;
  }
  if (!/^\d+$/.test(part)) {
    throw new Error(`Unsupported Node version part: ${part}`);
  }
  return Number(part);
}

/** Compares parsed versions numerically, including multi-digit minor versions. */
function compareNodeVersions(left: NodeVersion, right: NodeVersion): number {
  for (const index of [0, 1, 2] as const) {
    const difference = left[index] - right[index];
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function getMinimumNodeVersion(range: string): NodeVersion {
  const alternatives = range.split('||').map((alternative) => {
    const normalized = alternative.trim().replace(/([<>=]=?|\^)\s+/g, '$1');
    const match = normalized.match(/^(?:>=|\^)(\d+(?:\.\d+){0,2})(?:\s+<\d+(?:\.\d+){0,2})?$/);
    if (!match?.[1]) {
      throw new Error(`Root Node engine must be a lower-bound range: ${range}`);
    }
    return parseNodeVersion(match[1]);
  });

  return alternatives.reduce((minimum, alternative) => (
    compareNodeVersions(alternative, minimum) < 0 ? alternative : minimum
  ));
}

function satisfiesNodeRange(version: NodeVersion, range: string): boolean {
  return range.split('||').some((alternative) => satisfiesNodeAlternative(version, alternative));
}

function satisfiesNodeAlternative(version: NodeVersion, alternative: string): boolean {
  const normalized = alternative.trim().replace(/([<>=]=?|\^)\s+/g, '$1');
  if (!normalized) {
    throw new Error(`Unsupported empty Node engine range: ${alternative}`);
  }

  return normalized.split(/\s+/).every((comparator) => satisfiesNodeComparator(version, comparator));
}

function satisfiesNodeComparator(version: NodeVersion, comparator: string): boolean {
  if (comparator.startsWith('>=')) {
    return compareNodeVersions(version, parseNodeVersion(comparator.slice(2))) >= 0;
  }
  if (comparator.startsWith('>')) {
    return compareNodeVersions(version, parseNodeVersion(comparator.slice(1))) > 0;
  }
  if (comparator.startsWith('<=')) {
    return compareNodeVersions(version, parseNodeVersion(comparator.slice(2))) <= 0;
  }
  if (comparator.startsWith('<')) {
    return compareNodeVersions(version, parseNodeVersion(comparator.slice(1))) < 0;
  }
  if (comparator.startsWith('^')) {
    const minimum = parseNodeVersion(comparator.slice(1));
    return compareNodeVersions(version, minimum) >= 0
      && compareNodeVersions(version, getCaretUpperBound(minimum)) < 0;
  }
  return compareNodeVersions(version, parseNodeVersion(comparator)) === 0;
}

function getCaretUpperBound(version: NodeVersion): NodeVersion {
  if (version[0] > 0) {
    return [version[0] + 1, 0, 0];
  }
  if (version[1] > 0) {
    return [0, version[1] + 1, 0];
  }
  return [0, 0, version[2] + 1];
}

describe('dependency versions', () => {
  it.each(['@earendil-works/pi-ai', '@earendil-works/pi-coding-agent'])(
    'declares %s with a caret range and resolves every TAKT-process copy to 1.1.0',
    (packageName) => {
      const manifest = readPackageJson();
      const packageLock = readPackageLock();
      const copies = Object.entries(packageLock.packages ?? {})
        .filter(([packagePath]) => packagePath.endsWith(`node_modules/${packageName}`));
      const taktProcessCopies = copies.filter(([packagePath]) => (
        !packagePath.includes('node_modules/@deepseek-ai/dsh-llm-pi-ai/node_modules/')
      ));

      expect(manifest.dependencies?.[packageName]).toBe('^1.1.0');
      expect(packageLock.packages?.[`node_modules/${packageName}`]?.version).toBe('1.1.0');
      expect(taktProcessCopies.length).toBeGreaterThan(0);
      for (const [, lockedPackage] of taktProcessCopies) {
        expect(lockedPackage.version).toBe('1.1.0');
      }
    },
  );

  it('locks the mongoose MongoDB gcp-metadata peer dependency required by npm ci', () => {
    const packageLock = readPackageLock();
    const mongodb = getLockedPackage(
      packageLock,
      'node_modules/mongoose/node_modules/mongodb',
    );
    const gcpMetadata = getLockedPackage(
      packageLock,
      'node_modules/mongoose/node_modules/gcp-metadata',
    );

    expect(mongodb.peerDependencies?.['gcp-metadata']).toBe('^7.0.1');
    expect(gcpMetadata.version).toBe('7.0.1');
  });

  it('compares npm ci with valid and missing mongoose gcp-metadata lock entries', () => {
    const npmCli = getNpmCliPath();
    const npmVersion = getNpmVersion(npmCli);
    const packageLock = readPackageLock();
    const packagePath = 'node_modules/mongoose/node_modules/gcp-metadata';
    const lockWithoutGcpMetadata = structuredClone(packageLock);
    if (!lockWithoutGcpMetadata.packages) {
      throw new Error('package-lock.json packages are required');
    }
    delete lockWithoutGcpMetadata.packages[packagePath];

    const validLockResult = runNpmCi(packageLock, npmCli);
    const missingLockResult = runNpmCi(lockWithoutGcpMetadata, npmCli);

    expect(validLockResult.status, validLockResult.output).toBe(0);
    expect(lockWithoutGcpMetadata.packages[packagePath]).toBeUndefined();
    expect(npmVersion).toBe(LOCKFILE_VALIDATION_NPM_VERSION);
    expect(missingLockResult.status, missingLockResult.output).toBe(1);
    expect(missingLockResult.output).toContain(
      'Missing: gcp-metadata@7.0.1 from lock file',
    );
  });

  it('records integrity for registry tarballs required by the Nix dependency fetcher', () => {
    const packages = Object.entries(readPackageLock().packages ?? {});
    const registryPackages = packages.filter(([, info]) => (
      info.resolved?.startsWith('https://registry.npmjs.org/')
    ));

    expect(registryPackages.length).toBeGreaterThan(0);
    expect(registryPackages.filter(([, info]) => !info.integrity)
      .map(([packagePath]) => packagePath)).toEqual([]);
  });

  it('declares Node support compatible with runtime dependency engines', () => {
    const packageJson = readPackageJson();
    const packageLock = readPackageLock();
    const dependencies = packageJson.dependencies;
    const rootNodeRange = packageJson.engines?.node;
    if (!dependencies) {
      throw new Error('package.json dependencies are required');
    }
    if (!rootNodeRange) {
      throw new Error('package.json engines.node is required');
    }

    const rootMinimum = getMinimumNodeVersion(rootNodeRange);
    const incompatibleDependencies = Object.keys(dependencies).sort().flatMap((dependencyName) => {
      const lockedPackage = getLockedPackage(packageLock, `node_modules/${dependencyName}`);
      const dependencyNodeRange = lockedPackage.engines?.node;
      if (!dependencyNodeRange) {
        return [];
      }
      if (!lockedPackage.version) {
        throw new Error(`${dependencyName} is missing a locked version`);
      }
      if (satisfiesNodeRange(rootMinimum, dependencyNodeRange)) {
        return [];
      }
      return [`${dependencyName}@${lockedPackage.version} requires ${dependencyNodeRange}`];
    });

    expect(incompatibleDependencies).toEqual([]);
  });

  it('resolves traced-config through its public entrypoint', () => {
    const stdout = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "const resolved = import.meta.resolve('traced-config'); const mod = await import('traced-config'); process.stdout.write(JSON.stringify({ resolved, hasFactory: typeof mod.tracedConfig === 'function' }));",
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf-8',
      },
    );

    const result = JSON.parse(stdout) as { resolved: string; hasFactory: boolean };
    expect(result.resolved.startsWith('file://')).toBe(true);
    expect(result.hasFactory).toBe(true);
  });
});
