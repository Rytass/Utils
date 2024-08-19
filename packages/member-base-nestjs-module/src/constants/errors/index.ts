import {
  InvalidPasswordError,
  InvalidToken,
  MemberAlreadyExistedError,
  MemberBannedError,
  MemberNotFoundError,
  PasswordChangedError,
  PasswordDoesNotMeetPolicyError,
  PasswordExpiredError,
  PasswordShouldUpdatePasswordError,
  PasswordValidationError,
} from './base.error';

export const Errors = {
  MemberNotFoundError,
  PasswordDoesNotMeetPolicyError,
  InvalidPasswordError,
  PasswordValidationError,
  InvalidToken,
  MemberAlreadyExistedError,
  PasswordChangedError,
  MemberBannedError,
  PasswordExpiredError,
  PasswordShouldUpdatePasswordError,
};
