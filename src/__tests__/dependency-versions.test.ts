import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type PackageJson = {
  dependencies?: Record<string, string>;
  engines?: Record<string, string>;
};

type PackageLock = {
  packages?: Record<string, {
    version?: string;
    engines?: Record<string, string>;
    resolved?: string;
    integrity?: string;
  }>;
};

/** Reads the checked-out manifest, not an installed dependency's manifest. */
function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as PackageJson;
}

/** Reads the checked-out lockfile used by npm ci and the Nix dependency fetcher. */
function readPackageLock(): PackageLock {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'package-lock.json'), 'utf-8'),
  ) as PackageLock;
}

/** Requires an exact lockfile package path; missing dependencies fail the test. */
function getLockedPackage(packageLock: PackageLock, path: string): {
  version?: string;
  engines?: Record<string, string>;
} {
  const lockedPackage = packageLock.packages?.[path];
  if (!lockedPackage) {
    throw new Error(`${path} is not present in package-lock.json`);
  }
  return lockedPackage;
}

type NodeVersion = readonly [number, number, number];

/** Parses numeric Node versions, padding omitted minor and patch components with zero. */
function parseNodeVersion(version: string): NodeVersion {
  const normalized = version.replace(/^[vV]/, '');
  const parts = normalized.split('.');
  if (parts.length > 3 || parts.length === 0) {
    throw new Error(`Unsupported Node version: ${version}`);
  }

  return [parseVersionPart(parts[0]), parseVersionPart(parts[1]), parseVersionPart(parts[2])];
}

/** Converts one numeric version component and rejects unsupported syntax. */
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

/** Finds the lowest supported Node version across validated lower-bound alternatives. */
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

/** Checks whether any disjunctive engine-range alternative accepts the version. */
function satisfiesNodeRange(version: NodeVersion, range: string): boolean {
  return range.split('||').some((alternative) => satisfiesNodeAlternative(version, alternative));
}

/** Requires every whitespace-separated comparator within one engine-range alternative. */
function satisfiesNodeAlternative(version: NodeVersion, alternative: string): boolean {
  const normalized = alternative.trim().replace(/([<>=]=?|\^)\s+/g, '$1');
  if (!normalized) {
    throw new Error(`Unsupported empty Node engine range: ${alternative}`);
  }

  return normalized.split(/\s+/).every((comparator) => satisfiesNodeComparator(version, comparator));
}

/** Evaluates a numeric, inequality, or caret comparator against a parsed version. */
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

/** Returns the exclusive caret bound, including the narrower bounds for zero majors. */
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
    'declares %s with a caret range and resolves every TAKT-process copy to 1.0.4',
    (packageName) => {
      const manifest = readPackageJson();
      const packageLock = readPackageLock();
      const copies = Object.entries(packageLock.packages ?? {})
        .filter(([packagePath]) => packagePath.endsWith(`node_modules/${packageName}`));
      const taktProcessCopies = copies.filter(([packagePath]) => (
        !packagePath.includes('node_modules/@deepseek-ai/dsh-llm-pi-ai/node_modules/')
      ));

      expect(manifest.dependencies?.[packageName]).toBe('^1.0.4');
      expect(packageLock.packages?.[`node_modules/${packageName}`]?.version).toBe('1.0.4');
      expect(taktProcessCopies.length).toBeGreaterThan(0);
      for (const [, lockedPackage] of taktProcessCopies) {
        expect(lockedPackage.version).toBe('1.0.4');
      }
    },
  );

  it.each([
    'pi-agent-core',
    'pi-ai',
    'pi-codemode',
    'pi-coding-agent',
    'pi-mcp',
    'pi-telemetry',
    'pi-tui',
  ])('locks the root Pi family package %s to its 1.0.4 registry tarball', (name) => {
    const packagePath = `node_modules/@earendil-works/${name}`;
    const lockedPackage = readPackageLock().packages?.[packagePath];

    expect(lockedPackage?.version).toBe('1.0.4');
    expect(lockedPackage?.resolved).toBe(
      `https://registry.npmjs.org/@earendil-works/${name}/-/${name}-1.0.4.tgz`,
    );
    expect(lockedPackage?.integrity).toMatch(/^sha512-[A-Za-z0-9+/]+={0,2}$/);
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
