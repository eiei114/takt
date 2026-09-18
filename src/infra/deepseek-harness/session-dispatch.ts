function abortError(reason: unknown): Error {
  const message = reason instanceof Error ? reason.message : 'DeepSeek Harness execution aborted';
  const error = new Error(message || 'DeepSeek Harness execution aborted');
  error.name = 'AbortError';
  return error;
}

export async function waitForAbortable<T>(
  operation: Promise<T>,
  abortSignal: AbortSignal | undefined,
): Promise<T> {
  if (abortSignal === undefined) {
    return operation;
  }
  if (abortSignal.aborted) {
    throw abortError(abortSignal.reason);
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      abortSignal.removeEventListener('abort', onAbort);
      reject(abortError(abortSignal.reason));
    };
    abortSignal.addEventListener('abort', onAbort, { once: true });
    void operation.then(
      (value: T) => {
        abortSignal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        abortSignal.removeEventListener('abort', onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

export interface SessionDispatchQueue {
  run<T>(
    sessionId: string,
    abortSignal: AbortSignal | undefined,
    operation: () => Promise<T>,
  ): Promise<T>;
  clear(): void;
}

export function createSessionDispatchQueue(): SessionDispatchQueue {
  const tails = new Map<string, Promise<void>>();

  return {
    run<T>(
      sessionId: string,
      abortSignal: AbortSignal | undefined,
      operation: () => Promise<T>,
    ): Promise<T> {
      const previous = tails.get(sessionId) ?? Promise.resolve();
      const scheduled = previous.then(async () => {
        if (abortSignal?.aborted === true) {
          throw abortError(abortSignal.reason);
        }
        return operation();
      });
      const nextTail = scheduled.then(() => undefined, () => undefined);
      tails.set(sessionId, nextTail);
      void nextTail.then(() => {
        if (tails.get(sessionId) === nextTail) {
          tails.delete(sessionId);
        }
      });
      return waitForAbortable(scheduled, abortSignal);
    },

    clear(): void {
      tails.clear();
    },
  };
}

export { abortError };
