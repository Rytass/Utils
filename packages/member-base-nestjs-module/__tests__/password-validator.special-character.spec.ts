import { Repository } from 'typeorm';
import { PasswordValidatorService } from '../src/services/password-validator.service';
import { MemberPasswordHistoryEntity } from '../src/models/member-password-history.entity';

interface ValidatorOptions {
  special?: boolean;
  regexp?: RegExp;
  historyLimit?: number;
  histories?: string[];
}

const createValidator = ({
  special = false,
  regexp,
  historyLimit,
  histories = [],
}: ValidatorOptions = {}): PasswordValidatorService => {
  const qb = {
    andWhere: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(histories.map(password => ({ password }))),
  };

  const repo = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  } as unknown as Repository<MemberPasswordHistoryEntity>;

  return new PasswordValidatorService(false, false, false, special, 8, regexp, historyLimit, repo, undefined);
};

describe('PasswordValidatorService special character requirement', () => {
  const validator = createValidator({ special: true });

  it('should reject a password made only of letters and digits', async () => {
    await expect(validator.validatePassword('OwnerChosenLink2026')).resolves.toBe(false);
    await expect(validator.validatePassword('ABCDEFGH12345678')).resolves.toBe(false);
  });

  it.each([...'!><.,?@#$%^&*;:\'"|\\/~`()-_+={}[]'])('should accept %s as the special character', async char => {
    await expect(validator.validatePassword(`Abcdefg1${char}`)).resolves.toBe(true);
  });

  it('should reject a password whose only extra character is not in the allowed set', async () => {
    await expect(validator.validatePassword('Abcdefg1é')).resolves.toBe(false);
  });
});
