import { Repository } from 'typeorm';
import { PasswordValidatorService } from '../src/services/password-validator.service';
import { BaseMemberEntity } from '../src/models/base-member.entity';
import { MemberPasswordHistoryEntity } from '../src/models/member-password-history.entity';

const DAY = 24 * 60 * 60 * 1000;

const createValidator = (passwordAgeLimitInDays: number | undefined): PasswordValidatorService =>
  new PasswordValidatorService(
    true,
    true,
    true,
    false,
    8,
    undefined,
    undefined,
    {} as unknown as Repository<MemberPasswordHistoryEntity>,
    passwordAgeLimitInDays,
  );

const memberChangedAt = (passwordChangedAt: unknown): BaseMemberEntity => {
  const member = new BaseMemberEntity();

  member.passwordChangedAt = passwordChangedAt as Date;

  return member;
};

describe('PasswordValidatorService.shouldUpdatePassword', () => {
  const validator = createValidator(90);
  const longAgo = new Date(Date.now() - 400 * DAY);
  const recently = new Date(Date.now() - 5 * DAY);

  it('should expire a password older than the limit and keep a recent one', () => {
    expect(validator.shouldUpdatePassword(memberChangedAt(longAgo))).toBe(true);
    expect(validator.shouldUpdatePassword(memberChangedAt(recently))).toBe(false);
  });

  it('should reach the same answers when the timestamp arrives as a string', () => {
    // What a pg type parser returning strings hands over, in ISO and in the
    // driver's own text format. Read as a Date by luxon it was invalid, and an
    // invalid date never expired.
    expect(validator.shouldUpdatePassword(memberChangedAt(longAgo.toISOString()))).toBe(true);
    expect(validator.shouldUpdatePassword(memberChangedAt('2019-03-04 05:06:07.123456+00'))).toBe(true);
    expect(validator.shouldUpdatePassword(memberChangedAt(recently.toISOString()))).toBe(false);
  });

  it('should expire a password whose age cannot be read', () => {
    expect(validator.shouldUpdatePassword(memberChangedAt('not a timestamp'))).toBe(true);
  });

  it('should leave a member with no recorded change alone, as before', () => {
    expect(validator.shouldUpdatePassword(memberChangedAt(null))).toBe(false);
    expect(validator.shouldUpdatePassword(memberChangedAt(undefined))).toBe(false);
  });

  it('should never expire a password set to infinity, however it arrives', () => {
    // node-postgres hands the column value 'infinity' over as the number
    // Infinity; a string parser hands it over as written.
    expect(validator.shouldUpdatePassword(memberChangedAt(Infinity))).toBe(false);
    expect(validator.shouldUpdatePassword(memberChangedAt('infinity'))).toBe(false);
    expect(validator.shouldUpdatePassword(memberChangedAt('Infinity'))).toBe(false);
  });

  it('should judge everything that is not a string exactly as it always did', () => {
    expect(validator.shouldUpdatePassword(memberChangedAt(new Date(Number.NaN)))).toBe(false);
    expect(validator.shouldUpdatePassword(memberChangedAt(longAgo.getTime()))).toBe(false);
  });

  it('should count the whole day of expiry as still valid', () => {
    const limit = 90;
    // Noon, so that "an hour ago" is still today in whatever zone this runs.
    const noon = new Date(2026, 5, 15, 12, 0, 0).getTime();

    jest.useFakeTimers().setSystemTime(noon);

    try {
      // The limit ran out an hour ago by the clock; it holds until midnight.
      expect(validator.shouldUpdatePassword(memberChangedAt(new Date(noon - limit * DAY - 60 * 60 * 1000)))).toBe(
        false,
      );

      // A day earlier, and yesterday was the last day.
      expect(validator.shouldUpdatePassword(memberChangedAt(new Date(noon - (limit + 1) * DAY)))).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should never expire anything when no limit is configured', () => {
    expect(createValidator(undefined).shouldUpdatePassword(memberChangedAt(longAgo))).toBe(false);
  });
});
