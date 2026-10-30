import type { ExecutionContext } from '@nestjs/common';
import type { AuthCacheScope } from '../typings/auth-cache-scope';
import { getAuthScope } from './get-auth-scope';

/**
 * `key` is a function so that a checker left at `'none'` never pays for
 * building one — the guard runs on every guarded field.
 */
export type ScopedMemo = <T>(
  context: ExecutionContext | undefined,
  key: () => string,
  compute: () => Promise<T>,
) => Promise<T>;

const passThrough: ScopedMemo = <T>(
  _context: ExecutionContext | undefined,
  _key: () => string,
  compute: () => Promise<T>,
): Promise<T> => compute();

/**
 * Upper bound on reusing one result, on top of the scope itself.
 *
 * getAuthScope already refuses subscriptions, so an operation is the only thing
 * a result can outlive. This keeps that true if a driver hands out a context
 * that lives longer than one — a graphql-ws server whose context factory
 * returns the same object for every query on a connection, say: nothing is
 * trusted for more than a minute past the moment it was decided.
 */
export const MAX_SCOPED_REUSE_MS = 60 * 1000;

interface MemoEntry {
  pending: Promise<unknown>;
  createdAt: number;
}

/**
 * Reuse an async result for the rest of the unit of work getAuthScope names.
 *
 * The promise is stored, not its value: the fields of one row reach the guard
 * together, and waiting for the first to settle before caching would let every
 * one of them miss. A rejection removes only its own entry — a later call may
 * already have replaced it — so the next caller retries instead of inheriting
 * the failure.
 *
 * Only `'operation'` turns reuse on. Anything else — `null`, a misspelling —
 * leaves it off, because the safe reading of a value nobody meant is the one
 * that changes nothing.
 */
export const createScopedMemo = (scope: AuthCacheScope = 'none'): ScopedMemo => {
  if (scope !== 'operation') return passThrough;

  const entriesByScope = new WeakMap<object, Map<string, MemoEntry>>();

  return <T>(context: ExecutionContext | undefined, buildKey: () => string, compute: () => Promise<T>): Promise<T> => {
    const owner = getAuthScope(context);

    if (!owner) return compute();

    const existing = entriesByScope.get(owner);
    const entries = existing ?? new Map<string, MemoEntry>();

    if (!existing) entriesByScope.set(owner, entries);

    const key = buildKey();
    const cached = entries.get(key);

    // performance.now rather than Date.now: the wall clock can be set back, and
    // an entry created before that would then look young for as long again.
    const now = performance.now();

    if (cached && now - cached.createdAt <= MAX_SCOPED_REUSE_MS) return cached.pending as Promise<T>;

    // Expired entries go whenever a new one comes in, so a context that lives far
    // longer than an operation — one per graphql-ws connection, say — does not
    // pile up every token it has ever seen. One left idle keeps what it has
    // until then, or until the context itself is collected.
    //
    // Entries are kept in creation order (a replaced key is deleted before it is
    // set again, so it moves to the end), which lets the sweep stop at the first
    // one still fresh instead of walking a ten-thousand-row list on every miss.
    for (const [staleKey, stale] of entries) {
      if (now - stale.createdAt <= MAX_SCOPED_REUSE_MS) break;

      entries.delete(staleKey);
    }

    const pending = compute();
    const entry: MemoEntry = { pending, createdAt: now };

    entries.delete(key);
    entries.set(key, entry);

    pending.catch((): void => {
      if (entries.get(key) === entry) entries.delete(key);
    });

    return pending;
  };
};
