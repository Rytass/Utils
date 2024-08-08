import { Inject, Injectable } from '@nestjs/common';
import {
  PASSWORD_SHOULD_INCLUDE_UPPERCASE,
  PASSWORD_SHOULD_INCLUDE_LOWERCASE,
  PASSWORD_SHOULD_INCLUDE_DIGIT,
  PASSWORD_SHOULD_INCLUDE_SPECIAL_CHARACTER,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_REGEXP,
} from '../typings/member-base-providers';

@Injectable()
export class PasswordValidatorService {
  constructor(
    @Inject(PASSWORD_SHOULD_INCLUDE_UPPERCASE)
    private readonly passwordShouldIncludeUppercase: boolean,
    @Inject(PASSWORD_SHOULD_INCLUDE_LOWERCASE)
    private readonly passwordShouldIncludeLowercase: boolean,
    @Inject(PASSWORD_SHOULD_INCLUDE_DIGIT)
    private readonly passwordShouldIncludeDigit: boolean,
    @Inject(PASSWORD_SHOULD_INCLUDE_SPECIAL_CHARACTER)
    private readonly passwordShouldIncludeSpecialCharacter: boolean,
    @Inject(PASSWORD_MIN_LENGTH)
    private readonly passwordMinLength: number,
    @Inject(PASSWORD_POLICY_REGEXP)
    private readonly passwordPolicyRegExp: RegExp | undefined,
  ) {}

  validatePassword(password: string): boolean {
    const trimmed = password.trim();

    if (this.passwordPolicyRegExp) {
      return this.passwordPolicyRegExp.test(trimmed);
    }

    if (trimmed.length < this.passwordMinLength) {
      return false;
    }

    if (this.passwordShouldIncludeUppercase && !/[A-Z]/.test(trimmed)) {
      return false;
    }

    if (this.passwordShouldIncludeLowercase && !/[a-z]/.test(trimmed)) {
      return false;
    }

    if (this.passwordShouldIncludeDigit && !/[0-9]/.test(trimmed)) {
      return false;
    }

    if (
      this.passwordShouldIncludeSpecialCharacter &&
      !/[!><.,?@#$%^&*;:'"|\\/~`()-_+={}[\]]/.test(trimmed)
    ) {
      return false;
    }

    return true;
  }
}
