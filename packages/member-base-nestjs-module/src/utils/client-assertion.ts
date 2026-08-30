import { createHash, createPrivateKey, randomUUID, X509Certificate } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { AuthProviderMisconfiguredError } from '../constants/errors/base.error';

/**
 * A certificate credential, as an application registration stores it.
 *
 * Both are PEM. The certificate is supplied rather than a thumbprint on
 * purpose: the assertion needs the base64url SHA-256 of the certificate's DER
 * encoding, portals display thumbprints in more than one hash and encoding, and
 * asking for "the thumbprint" invites pasting the wrong one — which produces a
 * correct-looking assertion and an `invalid_client` with nothing to debug. It
 * is computed here instead.
 */
export interface ClientCertificate {
  /** PEM of the public certificate registered on the application. */
  certificate: string;
  /** PEM of the matching private key. */
  privateKey: string;
}

/** How long an assertion is valid. Short: it is minted per request. */
const ASSERTION_LIFETIME_SECONDS = 120;

export const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

/**
 * `x5t#S256`: base64url of the SHA-256 over the certificate's DER encoding.
 *
 * Derived from the certificate rather than taken as input, so there is no way
 * to supply the wrong hash or the wrong encoding.
 */
export const certificateToX5tS256 = (certificate: string): string =>
  createHash('sha256').update(parseCertificate(certificate).raw).digest('base64url');

const parseCertificate = (certificate: string): X509Certificate => {
  try {
    return new X509Certificate(certificate);
  } catch (error) {
    throw new AuthProviderMisconfiguredError(
      `clientCertificate.certificate is not a readable PEM certificate: ${(error as Error).message}. ` +
        'It must be the public certificate (-----BEGIN CERTIFICATE-----), not the private key.',
    );
  }
};

/**
 * Refuse a credential that cannot possibly authenticate, while it is still
 * obvious why.
 *
 * Every failure of certificate authentication comes back from the issuer as a
 * bare `invalid_client` with no reason attached, and the two common causes look
 * identical from the outside: the certificate was never uploaded to *this*
 * application registration, or the PEM certificate and the PEM key are not a
 * pair. Only the second is knowable here — so it is checked here, and the
 * message says plainly that the first is what remains if this passed.
 */
export const assertUsableCertificate = (credential: ClientCertificate): void => {
  const certificate = parseCertificate(credential.certificate);

  let privateKey;

  try {
    privateKey = createPrivateKey(credential.privateKey);
  } catch (error) {
    throw new AuthProviderMisconfiguredError(
      `clientCertificate.privateKey is not a readable PEM private key: ${(error as Error).message}`,
    );
  }

  if (!certificate.checkPrivateKey(privateKey)) {
    throw new AuthProviderMisconfiguredError(
      'clientCertificate.privateKey does not match clientCertificate.certificate — they are not a pair. ' +
        'Both are individually valid PEM, so this is the wrong file rather than a malformed one. ' +
        'If they do match, the remaining cause of an invalid_client is that this certificate was never ' +
        'uploaded to this application registration.',
    );
  }
};

/**
 * A private-key-JWT client credential (RFC 7523), signed fresh per request.
 *
 * `aud` must be the token endpoint the issuer **publishes**, not whatever
 * address the request is actually sent to: it is the value the issuer checks
 * the assertion against, so an internal back-channel rewrite must not reach it.
 *
 * Nothing is cached. The assertion is single-use by construction — a fresh
 * `jti` every time — which is also what keeps the provider stateless.
 *
 * `alg: PS256` with `x5t#S256` is what Microsoft's certificate credentials
 * specification calls for, and is valid RFC 7523 for any issuer that accepts
 * `private_key_jwt`.
 *
 * @see https://learn.microsoft.com/en-us/entra/identity-platform/certificate-credentials
 * @see https://datatracker.ietf.org/doc/html/rfc7523#section-3
 */
export const signClientAssertion = (params: {
  clientId: string;
  /** The issuer's published token endpoint. */
  audience: string;
  credential: ClientCertificate;
}): string => {
  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      // RFC 7523 §3: the client is both the issuer and the subject of its own
      // assertion.
      iss: params.clientId,
      sub: params.clientId,
      aud: params.audience,
      jti: randomUUID(),
      nbf: now,
      iat: now,
      exp: now + ASSERTION_LIFETIME_SECONDS,
    },
    params.credential.privateKey,
    {
      algorithm: 'PS256',
      header: {
        alg: 'PS256',
        typ: 'JWT',
        'x5t#S256': certificateToX5tS256(params.credential.certificate),
      } as unknown as jwt.JwtHeader,
    },
  );
};

/**
 * The form parameters that carry a client assertion in a token request.
 *
 * A helper rather than two literals, so the two call sites cannot drift on the
 * assertion type string.
 */
export const clientAssertionParams = (params: {
  clientId: string;
  audience: string;
  credential: ClientCertificate;
}): Record<string, string> => ({
  client_assertion_type: CLIENT_ASSERTION_TYPE,
  client_assertion: signClientAssertion(params),
});
