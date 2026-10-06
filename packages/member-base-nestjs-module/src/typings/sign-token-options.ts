import type { SessionContext, SessionTokenBinding } from './session-tracking-options';

export interface SignTokenOptions {
  /**
   * Epoch seconds of the moment the member actually proved its identity.
   *
   * Defaults to "now" when omitted, which is correct for a fresh login. Flows
   * that re-issue tokens on behalf of an earlier authentication (most notably
   * refreshToken) must forward the original value, otherwise every refresh
   * would silently make the session look freshly authenticated and defeat any
   * downstream max_age / re-authentication check.
   *
   * Pass null to omit the claim entirely. This is what refreshToken does when
   * the incoming token predates the claim: a token whose authentication time is
   * unknown must not be presented as freshly authenticated, so the claim is
   * left absent and downstream checks fail closed.
   */
  authTime?: number | null;

  /**
   * The session this token belongs to.
   *
   * `signAccessToken` stamps its `sid`; without it the access token simply
   * carries none. `signRefreshToken` binds the token to it; without it a new
   * session is opened for the token, since a refresh token that names no
   * session cannot be refreshed.
   */
  session?: SessionTokenBinding;

  /**
   * Request details stored on the session `signRefreshToken` opens when no
   * `session` is given. Ignored otherwise.
   */
  sessionContext?: Omit<SessionContext, 'domain'>;
}
