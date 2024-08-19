import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

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
