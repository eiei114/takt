#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const expectedVersion = '0.2.0-rc.2';
const packageManifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const constants = readFileSync(new URL('../src/infra/deepseek-harness/constants.ts', import.meta.url), 'utf8');
const sdkName = '@deepseek-ai/dsh-sdk-client';
const runtimeName = '@deepseek-ai/dsh';

for (const name of [sdkName, runtimeName]) {
  if (packageManifest.dependencies?.[name] !== expectedVersion) {
    throw new Error(`${name} must be pinned to ${expectedVersion} in package.json`);
  }
  if (lock.packages?.[`node_modules/${name}`]?.version !== expectedVersion) {
    throw new Error(`${name} lockfile version must be ${expectedVersion}`);
  }
  if (lock.packages?.['']?.dependencies?.[name] !== expectedVersion) {
    throw new Error(`${name} root lock entry must be pinned to ${expectedVersion}`);
  }
}

if (!constants.includes(`DEEPSEEK_HARNESS_SDK_VERSION = '${expectedVersion}'`)
  || !constants.includes(`DEEPSEEK_HARNESS_RUNTIME_VERSION = '${expectedVersion}'`)) {
  throw new Error('DeepSeek SDK/runtime constants must match the pinned npm packages');
}

const sdkPeers = lock.packages['node_modules/@deepseek-ai/dsh-sdk-client'].peerDependencies;
for (const name of ['@deepseek-ai/dsh-llm', '@deepseek-ai/dsh-session', '@deepseek-ai/dsh-sdk-protocol']) {
  if (sdkPeers?.[name] !== expectedVersion
    || lock.packages[`node_modules/${name}`]?.version !== expectedVersion) {
    throw new Error(`${name} SDK peer must match ${expectedVersion}`);
  }
}
if (sdkPeers?.['@deepseek-ai/cordis'] !== '~4.0.4') {
  throw new Error('DeepSeek SDK Cordis peer range changed; review compatibility before migration');
}
// npm omits peer-only packages from a dependency bundle unless explicitly
// bundled. The runtime loads these public services from its stock profile.
for (const [name, version] of Object.entries(packageManifest.dependencies)) {
  if (!name.startsWith('@deepseek-ai/')) continue;
  if (!packageManifest.bundleDependencies?.includes(name)
    || lock.packages[`node_modules/${name}`]?.version !== version
    || lock.packages[''].dependencies?.[name] !== version) {
    throw new Error(`${name} publish dependency must be pinned, locked and bundled`);
  }
}
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path.startsWith('node_modules/@deepseek-ai/') || !entry.peer) continue;
  const name = path.slice('node_modules/'.length);
  if (!packageManifest.bundleDependencies?.includes(name)
    || packageManifest.dependencies?.[name] !== entry.version) {
    throw new Error(`${name} runtime peer must be explicitly pinned and bundled`);
  }
}
console.log(`DeepSeek TypeScript SDK/runtime lock verified at ${expectedVersion}`);
