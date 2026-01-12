import { isValidVATNumber, verifyVatNumber } from '../src';

describe('isValidVATNumber', () => {
  it('should return true for valid VAT numbers', () => {
    expect(isValidVATNumber('12222538')).toBe(true);
    expect(isValidVATNumber(12345675)).toBe(true);
    expect(isValidVATNumber('24536806')).toBe(true);
    expect(isValidVATNumber('53212539')).toBe(true);
    expect(isValidVATNumber('04595252')).toBe(true); // sample from doc
    expect(isValidVATNumber('04595257')).toBe(true); // sample from doc
  });

  it('should return false for invalid VAT numbers', () => {
    expect(isValidVATNumber('12345678')).toBe(false);
    expect(isValidVATNumber(10000000)).toBe(false);
    expect(isValidVATNumber('87654321')).toBe(false);
    expect(isValidVATNumber('24536807')).toBe(false);
  });

  it('should return false for VAT numbers with incorrect length', () => {
    expect(isValidVATNumber('1234567')).toBe(false);
    expect(isValidVATNumber('123456789')).toBe(false);
    expect(isValidVATNumber('')).toBe(false);
  });

  it('should return false for non-numeric strings', () => {
    expect(isValidVATNumber('abcdefgh')).toBe(false);
    expect(isValidVATNumber('12ab5678')).toBe(false);
  });

  it('should handle number type input', () => {
    expect(isValidVATNumber(12222533)).toBe(true);
    expect(isValidVATNumber(12345678)).toBe(false);
    expect(isValidVATNumber(1234567)).toBe(false);
  });

  it('should handle special case when 7th digit is 7', () => {
    // 10458574 and 10458575 is a valid VAT number because of the special rule
    expect(isValidVATNumber('10458570')).toBe(true); // sample from doc
    expect(isValidVATNumber('10458574')).toBe(true); // sample from doc
    expect(isValidVATNumber('10458575')).toBe(true); // sample from doc
    // 10458576 is invalid
    expect(isValidVATNumber('10458576')).toBe(false);
  });

  it('should return false for undefined, null, or non-string/number input', () => {
    // @ts-expect-error
    expect(isValidVATNumber(undefined)).toBe(false);
    // @ts-expect-error
    expect(isValidVATNumber(null)).toBe(false);
    // @ts-expect-error
    expect(isValidVATNumber({})).toBe(false);
    // @ts-expect-error
    expect(isValidVATNumber([])).toBe(false);
  });
});

describe('verifyVatNumber (deprecated)', () => {
  it('should work the same as isValidVATNumber but log deprecation warning', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    expect(verifyVatNumber('12222538')).toBe(true);
    expect(verifyVatNumber('12345678')).toBe(false);

    expect(warnSpy).toHaveBeenCalledWith(
      `[DEPRECATION] 'verifyVatNumber' is deprecated and will be removed in future versions. Please use 'isValidVATNumber' instead.`,
    );

    warnSpy.mockRestore();
  });
});
