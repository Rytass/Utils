/**
 * Where an authentication or authorization result may be reused.
 *
 * - `'none'`: every guard run decides afresh.
 * - `'operation'`: reused within one HTTP request or one GraphQL operation.
 *   Subscriptions never reuse — see getAuthScope.
 */
export type AuthCacheScope = 'none' | 'operation';
