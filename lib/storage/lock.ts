const locks = new Map<string, Promise<unknown>>();

/** Runs `fn` after every earlier call with the same key has settled. */
export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const run = (locks.get(key) ?? Promise.resolve()).then(fn, fn);
  const settled = run.catch(() => {});
  locks.set(key, settled);
  void settled.then(() => {
    if (locks.get(key) === settled) locks.delete(key);
  });
  return run;
}
