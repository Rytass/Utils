import { verifyVatNumber } from '../src';

describe('verifyVatNumber', () => {
  it('should return true for valid VAT numbers', () => {
    expect(verifyVatNumber('12222538')).toBe(true);
    expect(verifyVatNumber(12345675)).toBe(true);
    expect(verifyVatNumber('24536806')).toBe(true);
    expect(verifyVatNumber('53212539')).toBe(true);
    expect(verifyVatNumber('04595252')).toBe(true); // sample from doc
    expect(verifyVatNumber('04595257')).toBe(true); // sample from doc
  });

  it('should return false for invalid VAT numbers', () => {
    expect(verifyVatNumber('12345678')).toBe(false);
    expect(verifyVatNumber(10000000)).toBe(false);
    expect(verifyVatNumber('87654321')).toBe(false);
    expect(verifyVatNumber('24536807')).toBe(false);
  });

  it('should return false for VAT numbers with incorrect length', () => {
    expect(verifyVatNumber('1234567')).toBe(false);
    expect(verifyVatNumber('123456789')).toBe(false);
    expect(verifyVatNumber('')).toBe(false);
  });

  it('should return false for non-numeric strings', () => {
    expect(verifyVatNumber('abcdefgh')).toBe(false);
    expect(verifyVatNumber('12ab5678')).toBe(false);
  });

  it('should handle number type input', () => {
    expect(verifyVatNumber(12222533)).toBe(true);
    expect(verifyVatNumber(12345678)).toBe(false);
    expect(verifyVatNumber(1234567)).toBe(false);
  });

  it('should handle special case when 7th digit is 7', () => {
    // 10458574 and 10458575 is a valid VAT number because of the special rule
    expect(verifyVatNumber('10458570')).toBe(true); // sample from doc
    expect(verifyVatNumber('10458574')).toBe(true); // sample from doc
    expect(verifyVatNumber('10458575')).toBe(true); // sample from doc
    // 10458576 is invalid
    expect(verifyVatNumber('10458576')).toBe(false);
  });

  it('should return false for undefined, null, or non-string/number input', () => {
    // @ts-expect-error
    expect(verifyVatNumber(undefined)).toBe(false);
    // @ts-expect-error
    expect(verifyVatNumber(null)).toBe(false);
    // @ts-expect-error
    expect(verifyVatNumber({})).toBe(false);
    // @ts-expect-error
    expect(verifyVatNumber([])).toBe(false);
  });
});
