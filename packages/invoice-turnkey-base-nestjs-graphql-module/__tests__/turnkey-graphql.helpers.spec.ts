import { ForbiddenException } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import type { Request } from 'express';
import {
  TurnkeyIdempotencyConflictError,
  TurnkeyPrintError,
  TurnkeyPrintErrorCode,
  TurnkeyValidationCode,
  TurnkeyValidationError,
} from '@rytass/invoice-turnkey-base-nestjs-module';
import {
  assertCompanyAccess,
  parseIsoDate,
  requireIdempotencyKey,
  runTurnkey,
  toGraphQLError,
} from '../src/turnkey-graphql.helpers';

const request = {} as Request;
const TAX_ID = '12345675';

describe('assertCompanyAccess', () => {
  it('denies by default when no access rule is configured', async () => {
    await expect(assertCompanyAccess({}, request, TAX_ID)).rejects.toThrow(ForbiddenException);
  });

  it('allows any company when allowAllCompanies is true', async () => {
    await expect(assertCompanyAccess({ allowAllCompanies: true }, request, TAX_ID)).resolves.toBeUndefined();
  });

  it('delegates to canAccessCompany and denies when it returns false', async () => {
    const canAccessCompany = jest.fn().mockResolvedValue(false);

    await expect(assertCompanyAccess({ canAccessCompany }, request, TAX_ID)).rejects.toThrow(
      'Cannot access this company',
    );

    expect(canAccessCompany).toHaveBeenCalledWith(request, TAX_ID);
  });

  it('allows when canAccessCompany returns true', async () => {
    await expect(assertCompanyAccess({ canAccessCompany: () => true }, request, TAX_ID)).resolves.toBeUndefined();
  });

  it('rejects malformed company tax ids before consulting the rule', async () => {
    const canAccessCompany = jest.fn().mockReturnValue(true);

    await expect(assertCompanyAccess({ canAccessCompany }, request, '1234')).rejects.toThrow('Invalid company tax id');
    expect(canAccessCompany).not.toHaveBeenCalled();
  });
});

describe('requireIdempotencyKey', () => {
  it('returns the key when it is present and within 255 characters', () => {
    expect(requireIdempotencyKey('order-0007')).toBe('order-0007');
  });

  it('rejects empty and oversized keys with IDEMPOTENCY_KEY_REQUIRED', () => {
    expect(() => requireIdempotencyKey('')).toThrow(GraphQLError);
    expect(() => requireIdempotencyKey('x'.repeat(256))).toThrow(GraphQLError);

    try {
      requireIdempotencyKey('');
    } catch (error) {
      expect((error as GraphQLError).extensions.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    }
  });
});

describe('toGraphQLError / runTurnkey', () => {
  it('maps TurnkeyValidationError to a GraphQLError carrying its code and field', async () => {
    const validation = new TurnkeyValidationError([
      { code: TurnkeyValidationCode.TAX_AMOUNT_MISMATCH, message: 'tax mismatch', field: 'taxAmount' },
    ]);

    const mapped = toGraphQLError(validation) as GraphQLError;

    expect(mapped).toBeInstanceOf(GraphQLError);
    expect(mapped.extensions.code).toBe('TAX_AMOUNT_MISMATCH');
    expect(mapped.extensions.field).toBe('taxAmount');
  });

  it('maps idempotency conflicts to IDEMPOTENCY_KEY_REUSED', async () => {
    const conflict = new TurnkeyIdempotencyConflictError('IDEMPOTENCY_KEY_REUSED', 'reused');

    await expect(runTurnkey(() => Promise.reject(conflict))).rejects.toMatchObject({
      extensions: { code: 'IDEMPOTENCY_KEY_REUSED' },
    });
  });

  it('passes unknown errors through untouched', async () => {
    const boom = new Error('db down');

    await expect(runTurnkey(() => Promise.reject(boom))).rejects.toBe(boom);
  });

  it('returns the operation result when it succeeds', async () => {
    await expect(runTurnkey(async () => 42)).resolves.toBe(42);
  });
});

describe('print errors', () => {
  it('passes proof error codes through as extensions.code', async () => {
    const mapped = toGraphQLError(
      new TurnkeyPrintError(TurnkeyPrintErrorCode.NOT_PRINTABLE, '不能列印'),
    ) as GraphQLError;

    expect(mapped).toBeInstanceOf(GraphQLError);
    expect(mapped.extensions.code).toBe('NOT_PRINTABLE');
  });
});

describe('parseIsoDate', () => {
  it('returns undefined for missing values', () => {
    expect(parseIsoDate(undefined, 'issuedAt')).toBeUndefined();
    expect(parseIsoDate(null, 'issuedAt')).toBeUndefined();
  });

  it('parses ISO 8601 strings', () => {
    expect(parseIsoDate('2026-10-20T10:03:12+08:00', 'issuedAt')?.toISOString()).toBe('2026-10-20T02:03:12.000Z');
  });

  it('rejects invalid dates with BAD_USER_INPUT', () => {
    try {
      parseIsoDate('not-a-date', 'issuedAt');
      throw new Error('expected parseIsoDate to throw');
    } catch (error) {
      expect((error as GraphQLError).extensions.code).toBe('BAD_USER_INPUT');
      expect((error as GraphQLError).extensions.field).toBe('issuedAt');
    }
  });
});
