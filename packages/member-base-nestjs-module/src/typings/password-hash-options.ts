/**
 * argon2 cost parameters.
 *
 * Declared here rather than imported from `argon2` so the option type survives
 * in the published `.d.ts` without dragging the native module into the type
 * graph of every consumer. The names and units match argon2's own Options.
 *
 * Left unset, argon2's defaults apply — deliberately, since the right cost is a
 * property of the hardware the application runs on, not of this package.
 */
export interface PasswordHashOptions {
  /** Memory used, in KiB. */
  memoryCost?: number;
  /** Iterations. */
  timeCost?: number;
  /** Lanes used. */
  parallelism?: number;
  /** 0 = argon2d, 1 = argon2i, 2 = argon2id. */
  type?: 0 | 1 | 2;
  hashLength?: number;
  /** Pepper. Rotating it invalidates every hash produced with the old value. */
  secret?: Buffer;
}
