interface StartupManifest {
  dependencies: Record<string, string>;
  bundleDependencies: string[];
}

interface StartupLock {
  packages: Record<string, {
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  }>;
}

interface DeepSeekRootManifest extends StartupManifest {
  devDependencies: Record<string, string>;
  files: string[];
}

interface DeepSeekManagedManifest {
  dependencies: Record<string, string>;
  overrides?: Record<string, string>;
}

export function verifyDeepSeekManagedLock(
  root: DeepSeekRootManifest,
  rootLock: StartupLock,
  managed: DeepSeekManagedManifest,
  lock: StartupLock,
  constants: string,
): void;
export function verifyStartupBundleLock(root: StartupManifest, lock: StartupLock): void;
export function verifyDeepSeekPackAssets(files: { path: string }[], root: StartupManifest): void;
