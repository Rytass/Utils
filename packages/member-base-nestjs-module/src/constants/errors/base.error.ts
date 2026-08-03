import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

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
