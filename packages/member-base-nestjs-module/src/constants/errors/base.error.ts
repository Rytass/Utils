import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type { CasbinAuthorizationDecision } from '../../typings/casbin-permission';

export class MemberNotFoundError extends BadRequestException {
  constructor() {
    super('Member not found');
  }

  code = 100;
}

export class PasswordDoesNotMeetPolicyError extends BadRequestException {
  constructor() {
    super('Password does not meet the policy');
  }

  code = 101;
}

export class InvalidPasswordError extends BadRequestException {
  constructor() {
    super('Invalid password');
  }

  code = 102;
}

export class PasswordValidationError extends InternalServerErrorException {
  constructor() {
    super('Password validation error');
  }

  code = 103;
}

export class InvalidToken extends BadRequestException {
  constructor() {
    super('Invalid token');
  }

  code = 104;
}

export class MemberAlreadyExistedError extends BadRequestException {
  constructor() {
    super('Member already existed');
  }

  code = 105;
}

export class PasswordChangedError extends BadRequestException {
  constructor() {
    super('Password changed, please sign in again');
  }

  code = 106;
}

export class MemberBannedError extends BadRequestException {
  constructor() {
    super('Member banned');
  }

  code = 107;
}

export class PasswordExpiredError extends BadRequestException {
  constructor() {
    super('Password expired, please update password');
  }

  code = 108;
}

export class PasswordShouldUpdatePasswordError extends BadRequestException {
  constructor() {
    super('Member should update password before login');
  }

  code = 109;
}

export class PasswordInHistoryError extends BadRequestException {
  constructor() {
    super('Password is in history');
  }

  code = 110;
}

export class AuthProviderNotFoundError extends BadRequestException {
  constructor(channel?: string) {
    super(channel ? `Authentication provider not found: ${channel}` : 'Authentication provider not found');
  }

  code = 111;
}

export class ExternalIdentityNotLinkedError extends BadRequestException {
  constructor() {
    super('External identity is not linked to any member');
  }

  code = 112;
}

export class AuthProviderMisconfiguredError extends InternalServerErrorException {
  constructor(message?: string) {
    super(message ?? 'Authentication provider is misconfigured');
  }

  code = 113;
}

/**
 * Thrown by OidcClientService. It lives here rather than under oidc/ so every
 * error code the package can raise is assigned in one file and cannot collide.
 */
export class OidcClientNotFoundError extends BadRequestException {
  constructor(clientId?: string) {
    super(clientId ? `Oidc client not found: ${clientId}` : 'Oidc client not found');
  }

  code = 114;
}

export class OidcClientAlreadyExistsError extends BadRequestException {
  constructor(clientId: string) {
    super(`Oidc client already registered: ${clientId}`);
  }

  code = 115;
}

/**
 * `clientId` is the primary key and removal is soft, so a removed id keeps
 * occupying it. Saying so is the difference between a fixable message and a
 * unique-violation stack trace from the driver.
 */
export class OidcClientIdRetiredError extends BadRequestException {
  constructor(clientId: string) {
    super(`Oidc client id belongs to a removed client and cannot be reused: ${clientId}`);
  }

  code = 116;
}

export class PublicOidcClientNotAllowedError extends BadRequestException {
  constructor() {
    super('Public oidc clients are disabled; register a confidential client');
  }

  code = 117;
}

export class InvalidOidcRedirectUriError extends BadRequestException {
  constructor(uri: string, reason: string) {
    super(`Invalid redirect uri (${reason}): ${uri}`);
  }

  code = 118;
}

export class InconsistentOidcClientGrantsError extends BadRequestException {
  constructor(message: string) {
    super(message);
  }

  code = 119;
}

/**
 * The five outcomes CasbinGuard can deny with.
 *
 * They exist because a guard that returns `false` produces exactly one thing —
 * `ForbiddenException('Forbidden resource')` — for causes that are not the same
 * question. An application deciding between 401 and 403, or between "log this
 * user out" and "hide this field", was left comparing that one string, which is
 * true of both an absent token and a policy denial. Each cause now carries its
 * own class and status.
 *
 * `InvalidToken` (code 104) is deliberately not reused: it is a
 * BadRequestException, and 400 is the wrong answer to a credential the guard
 * could not accept.
 */

/** No credential was presented at all. */
export class MissingAccessTokenError extends UnauthorizedException {
  constructor() {
    super('Access token is missing');
  }

  code = 120;
}

/** A credential was presented and did not verify — bad signature, expired, malformed. */
export class InvalidAccessTokenError extends UnauthorizedException {
  constructor() {
    super('Access token is invalid or expired');
  }

  code = 121;
}

/**
 * Authenticated, and the policy said no.
 *
 * `decision` carries whatever the permission checker reported (matched domain,
 * matched action, meta) for an exception filter or audit log to read. Nest
 * serializes only `getResponse()`, so it never reaches the client; only
 * `decision.reason`, which the application's own checker chose, becomes the
 * message.
 */
export class PermissionDeniedError extends ForbiddenException {
  constructor(readonly decision?: CasbinAuthorizationDecision) {
    super(decision?.reason ?? 'Permission denied');
  }

  code = 122;
}

/**
 * The handler carries none of `@AllowActions()`, `@Authenticated()` or
 * `@IsPublic()`, so it is unreachable for everyone including a super admin.
 *
 * That is a configuration mistake rather than a runtime denial, and it stays a
 * 403 rather than a 500 on purpose: the deny direction is the correct one, and
 * a route nobody declared should not page whoever watches the 5xx rate. The
 * handler is named in a warning on the server, not in this message.
 */
export class RouteMissingPermissionMetadataError extends ForbiddenException {
  constructor() {
    super('Route has no permission metadata');
  }

  code = 123;
}

/** An `@AllowActions()` route was reached while `CASBIN_ENFORCER` resolved to null. */
export class CasbinEnforcerUnavailableError extends ForbiddenException {
  constructor() {
    super('Casbin enforcer is not configured');
  }

  code = 124;
}

/**
 * A directory query failed at the source.
 *
 * A 5xx from Microsoft Graph, or a 4xx that retrying cannot fix (a revoked
 * application permission, a missing admin consent, an expired delta token).
 * `upstreamStatus` and `detail` carry Graph's own answer so an operator can
 * tell a throttled tenant apart from a misconfigured app registration without
 * turning on request logging. It is deliberately not called `status`: that name
 * belongs to `HttpException` and means the status this exception answers with,
 * which is not the one the directory replied.
 *
 * A 500 rather than a 400: nothing the caller passed is wrong, the directory
 * is unreachable or refusing this application.
 */
export class DirectoryRequestFailedError extends InternalServerErrorException {
  constructor(
    readonly upstreamStatus: number,
    readonly detail?: string,
    /**
     * How long the directory asked the caller to wait, in milliseconds, when it
     * said so and the wait was longer than this client is willing to hold a
     * request open. Present only on a throttle the caller has to reschedule.
     */
    readonly retryAfterMs?: number,
  ) {
    super(
      `Directory request failed with status ${upstreamStatus}${detail ? `: ${detail}` : ''}` +
        (retryAfterMs === undefined ? '' : ` (retry after ${Math.ceil(retryAfterMs / 1000)}s)`),
    );
  }

  code = 125;
}
