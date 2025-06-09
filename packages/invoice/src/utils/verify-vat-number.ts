/**
 * Verify the input is a valid Taiwanese VAT Number (營業稅籍編號)
 *
 * @param input - VAT Number (string or number)
 * @returns is `input` a valid VAT number
 *
 * @example
 * verifyVatNumber('12345675') // true
 * verifyVatNumber('12345678') // false
 */
export function verifyVatNumber(input: string | number): boolean {
  if (typeof input !== 'string' && typeof input !== 'number') return false;

  const vat = input.toString();

  if (!/^\d{8}$/.test(vat)) {
    return false;
  }

  const COEFFICIENTS = [1, 2, 1, 2, 1, 2, 4, 1];
  const digits = vat.split('').map((d) => parseInt(d, 10));

  const checksum = digits.reduce((sum, digit, index) => {
    const product = digit * COEFFICIENTS[index];

    return sum + Math.floor(product / 10) + (product % 10);
  }, 0);

  const divisor = 5;

  return (
    checksum % divisor === 0 ||
    (digits[6] === 7 && (checksum + 1) % divisor === 0)
  );
}
