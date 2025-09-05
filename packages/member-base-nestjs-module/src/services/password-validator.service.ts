import { Inject, Injectable } from '@nestjs/common';
import { verify } from 'argon2';
import {
  PASSWORD_SHOULD_INCLUDE_UPPERCASE,
  PASSWORD_SHOULD_INCLUDE_LOWERCASE,
  PASSWORD_SHOULD_INCLUDE_DIGIT,
  PASSWORD_SHOULD_INCLUDE_SPECIAL_CHARACTER,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_REGEXP,
  PASSWORD_HISTORY_LIMIT,
  PASSWORD_AGE_LIMIT_IN_DAYS,
} from '../typings/member-base-providers';
import { BaseMemberEntity } from '../models/base-member.entity';
import { MemberPasswordHistoryEntity, MemberPasswordHistoryRepo } from '../models/member-password-history.entity';
import { Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { generate } from 'generate-password';
import { PasswordInHistoryError } from '../constants/errors/base.error';

@Injectable()
export class PasswordValidatorService<MemberEntity extends BaseMemberEntity = BaseMemberEntity> {
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
    @Inject(PASSWORD_HISTORY_LIMIT)
    private readonly passwordHistoryLimit: number | undefined,
    @Inject(MemberPasswordHistoryRepo)
    private readonly memberPasswordHistoryRepo: Repository<MemberPasswordHistoryEntity>,
    @Inject(PASSWORD_AGE_LIMIT_IN_DAYS)
    private readonly passwordAgeLimitInDays: number | undefined,
  ) {}

  generateValidPassword(): string {
    return generate({
      length: this.passwordMinLength,
      numbers: this.passwordShouldIncludeDigit,
      uppercase: this.passwordShouldIncludeUppercase,
      lowercase: this.passwordShouldIncludeLowercase,
      symbols: this.passwordShouldIncludeSpecialCharacter,
    });
  }

  shouldUpdatePassword<T extends MemberEntity = MemberEntity>(member: T): boolean {
    if (!this.passwordAgeLimitInDays) return false;

    const validBefore = DateTime.fromJSDate(member.passwordChangedAt)
      .plus({ days: this.passwordAgeLimitInDays })
      .endOf('day')
      .toMillis();

    return validBefore < DateTime.now().toMillis();
  }

  async validatePassword(password: string, memberId?: string): Promise<boolean> {
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

    if (this.passwordShouldIncludeSpecialCharacter && !/[!><.,?@#$%^&*;:'"|\\/~`()-_+={}[\]]/.test(trimmed)) {
      return false;
    }

    if (this.passwordHistoryLimit) {
      const qb = this.memberPasswordHistoryRepo.createQueryBuilder('histories');

      qb.andWhere('histories.memberId = :memberId', { memberId });
      qb.addOrderBy('histories.createdAt', 'DESC');

      qb.take(this.passwordHistoryLimit);

      const histories = await qb.getMany();

      try {
        await histories
          .map(history => async () => {
            const isVerify = await verify(history.password, password);

            if (isVerify) {
              throw new PasswordInHistoryError();
            }
          })
          .reduce((prev, next) => prev.then(next), Promise.resolve());
      } catch (_ex) {
        return false;
      }
    }

    return true;
  }
}
