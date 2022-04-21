/**
 * @jest-environment node
 */

import { normalizedTaiwanMobilePhoneNumber, TAIWAN_PHONE_NUMBER_RE } from '@rytass/sms';

describe('Taiwan Mobile Helpers', () => {
  it('should detect taiwan mobile number', () => {
    expect(TAIWAN_PHONE_NUMBER_RE.test('0978585959')).toBeTruthy();
    expect(TAIWAN_PHONE_NUMBER_RE.test('0978-585-959')).toBeTruthy();
    expect(TAIWAN_PHONE_NUMBER_RE.test('886-978-585-959')).toBeTruthy();
    expect(TAIWAN_PHONE_NUMBER_RE.test('+886-978-585-959')).toBeTruthy();
    expect(TAIWAN_PHONE_NUMBER_RE.test('0978-585959')).toBeTruthy();
    expect(TAIWAN_PHONE_NUMBER_RE.test('+886978585959')).toBeTruthy();
    expect(TAIWAN_PHONE_NUMBER_RE.test('+86-978-585-959')).toBeFalsy();
    expect(TAIWAN_PHONE_NUMBER_RE.test('+1-978-585-959')).toBeFalsy();
    expect(TAIWAN_PHONE_NUMBER_RE.test('+1-975285585-959')).toBeFalsy();
    expect(TAIWAN_PHONE_NUMBER_RE.test('+1-3g1d22-959')).toBeFalsy();
  });

  it('should normalize taiwan mobile number', () => {
    expect(normalizedTaiwanMobilePhoneNumber('0978-585-959')).toBe('0978585959');
    expect(normalizedTaiwanMobilePhoneNumber('0978585959')).toBe('0978585959');
    expect(normalizedTaiwanMobilePhoneNumber('886978585959')).toBe('0978585959');
    expect(normalizedTaiwanMobilePhoneNumber('886-978-585-959')).toBe('0978585959');
    expect(normalizedTaiwanMobilePhoneNumber('+886-978-585-959')).toBe('0978585959');
    expect(normalizedTaiwanMobilePhoneNumber('+886978585959')).toBe('0978585959');
  });
});
