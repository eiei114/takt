#!/usr/bin/env node

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { join } from 'node:path';

const LOCK_DIRECTORY_NAME = '.runtime-state-lock';
const CLEANUP_BARRIER_FILE = 'cleanup-blocked';
const LOCK_WAIT_TIMEOUT_MS = 10_000;
const LOCK_RETRY_DELAY_MS = 10;
const CLEANUP_BLOCKED_MESSAGE =
  'DeepSeek Harness runtime cleanup is unconfirmed; no new runtime can start until the previous runtime exits.';

function cleanupBlockedError() {
  return new Error(CLEANUP_BLOCKED_MESSAGE);
}

function isProcessGroupAlive(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    if (error?.code === 'EPERM') return true;
    return undefined;
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    if (error?.code === 'EPERM') return true;
    return undefined;
  }
}

async function readCleanupBarrier(stateDirectory) {
  const barrierPath = join(stateDirectory, CLEANUP_BARRIER_FILE);
  let content;
  try {
    content = await readFile(barrierPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw cleanupBlockedError();
  }
  try {
    const barrier = JSON.parse(content);
    const runtimePids = barrier?.runtimePids;
    const unknownRuntime = barrier?.unknownRuntime;
    if (unknownRuntime !== true && !Array.isArray(runtimePids)) {
      throw cleanupBlockedError();
    }
    if (!Array.isArray(runtimePids)
      || !runtimePids.every((pid) => Number.isSafeInteger(pid) && pid > 0)) {
      throw cleanupBlockedError();
    }
    return { path: barrierPath, runtimePids, unknownRuntime };
  } catch {
    throw cleanupBlockedError();
  }
}

export async function withDeepSeekRuntimeStateFileLock(stateDirectory, operation) {
  try {
    await mkdir(stateDirectory, { recursive: true, mode: 0o700 });
  } catch {
    throw cleanupBlockedError();
  }

  const lockDirectory = join(stateDirectory, LOCK_DIRECTORY_NAME);
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
  while (true) {
    try {
      await mkdir(lockDirectory, { mode: 0o700 });
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST' || Date.now() >= deadline) {
        throw cleanupBlockedError();
      }
      await delay(LOCK_RETRY_DELAY_MS);
    }
  }

  let retainLock = false;
  const lock = { retain: () => { retainLock = true; } };
  let operationFailed = false;
  let operationError;
  let result;
  try {
    try {
      await writeFile(join(lockDirectory, 'owner'), `${process.pid}\n`, { mode: 0o600, flag: 'wx' });
    } catch {
      lock.retain();
      throw cleanupBlockedError();
    }
    result = await operation(lock);
  } catch (error) {
    operationFailed = true;
    operationError = error;
  }
  if (!retainLock) {
    try {
      await rm(lockDirectory, { recursive: true });
    } catch {
      throw cleanupBlockedError();
    }
  }
  if (operationFailed) throw operationError;
  return result;
}

/** Caller must hold `withDeepSeekRuntimeStateFileLock` for `stateDirectory`. */
export async function assertDeepSeekRuntimeCreationAllowedLocked(
  stateDirectory,
  ownerDirectory,
  parentPid,
) {
  try {
    await mkdir(ownerDirectory, { recursive: true, mode: 0o700 });
  } catch {
    throw cleanupBlockedError();
  }

  let ownerEntries;
  try {
    ownerEntries = await readdir(ownerDirectory);
  } catch {
    throw cleanupBlockedError();
  }

  const barrier = await readCleanupBarrier(stateDirectory);
  if (barrier !== undefined) {
    if (barrier.unknownRuntime === true) throw cleanupBlockedError();
    for (const pid of barrier.runtimePids) {
      if (isProcessGroupAlive(pid) !== false) throw cleanupBlockedError();
    }
    try {
      await rm(barrier.path, { force: true });
    } catch {
      throw cleanupBlockedError();
    }
  }

  for (const entry of ownerEntries) {
    const ownerPath = join(ownerDirectory, entry);
    let owner;
    try {
      owner = JSON.parse(await readFile(ownerPath, 'utf8'));
      if (![owner?.parentPid, owner?.supervisorPid, owner?.runtimePid]
        .every((pid) => Number.isSafeInteger(pid) && pid > 0)) {
        throw cleanupBlockedError();
      }
    } catch {
      throw cleanupBlockedError();
    }

    const groupAlive = isProcessGroupAlive(owner.runtimePid);
    if (groupAlive === false) {
      try {
        await rm(ownerPath, { force: true });
      } catch {
        throw cleanupBlockedError();
      }
      continue;
    }
    if (owner.cleanupFailed === true) throw cleanupBlockedError();
    if (owner.parentPid === parentPid && isProcessAlive(owner.supervisorPid) === true) continue;
    throw cleanupBlockedError();
  }
}

/** Caller must hold `withDeepSeekRuntimeStateFileLock` for `stateDirectory`. */
export async function markDeepSeekCleanupBarrierLocked(stateDirectory, ownerDirectory) {
  let runtimePids = [];
  let unknownRuntime = false;
  try {
    const entries = await readdir(ownerDirectory);
    unknownRuntime = entries.length === 0;
    runtimePids = await Promise.all(entries.map(async (entry) => {
      const owner = JSON.parse(await readFile(join(ownerDirectory, entry), 'utf8'));
      if (!Number.isSafeInteger(owner?.runtimePid) || owner.runtimePid <= 0) {
        throw cleanupBlockedError();
      }
      return owner.runtimePid;
    }));
  } catch {
    unknownRuntime = true;
  }

  const barrierPath = join(stateDirectory, CLEANUP_BARRIER_FILE);
  try {
    await writeFile(barrierPath, `${JSON.stringify({ runtimePids, unknownRuntime })}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
  } catch (error) {
    if (error?.code !== 'EEXIST') throw cleanupBlockedError();
  }
}
