import { hash } from 'argon2';
import { Repository } from 'typeorm';
import { PasswordValidatorService } from '../src/services/password-validator.service';
import { MemberPasswordHistoryEntity } from '../src/models/member-password-history.entity';
import { OptionProviders } from '../src/constants/option-providers';
import { LINK_EXISTING_ACCOUNT } from '../src/typings/member-base.tokens';

describe('password policy security regressions', () => {
  it('requires an actual special character', async () => {
    const validator = new PasswordValidatorService(
      true,
      true,
      true,
      true,
      8,
      undefined,
      undefined,
      {} as Repository<MemberPasswordHistoryEntity>,
      undefined,
    );

    expect(await validator.validatePassword('Abcdefg1')).toBe(false);
    for (const symbol of ['!', '-', '_', '[', ']', '(', ')', '+']) {
      expect(await validator.validatePassword(`Abcdefg1${symbol}`)).toBe(true);
    }
  });

  it('enforces password history after a custom format rule, including stateful regex flags', async () => {
    const password = 'UsedPassw0rd!';
    const stored = await hash(password);
    const qb = {
      andWhere: jest.fn(),
      addOrderBy: jest.fn(),
      take: jest.fn(),
      getMany: jest.fn(async () => [{ password: stored }]),
    };

    const validator = new PasswordValidatorService(
      true,
      true,
      true,
      true,
      8,
      /^.{8,}$/g,
      5,
      { createQueryBuilder: () => qb } as unknown as Repository<MemberPasswordHistoryEntity>,
      undefined,
    );

    expect(await validator.validatePassword(password, 'member')).toBe(false);
    expect(await validator.validatePassword('NewPassw0rd!', 'member')).toBe(true);
    expect(await validator.validatePassword('NewPassw0rd!', 'member')).toBe(true);
    expect(qb.getMany).toHaveBeenCalledTimes(3);
  });

  it('defaults external account linking to false', () => {
    const provider = OptionProviders.find(value => value.provide === LINK_EXISTING_ACCOUNT) as {
      useFactory: (options?: object) => unknown;
    };

    expect(provider.useFactory()).toBe(false);
    expect(provider.useFactory({ linkExistingAccount: 'verified-only' })).toBe('verified-only');
  });
});
