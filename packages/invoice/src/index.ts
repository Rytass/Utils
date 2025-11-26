export * from './typings';
export * from './invoice-gateway';
export * from './invoice';
export * from './invoice-allowance';
export * from './utils/get-tax-type-from-items';
export * from './utils/is-valid-vat-number';
export type { PaymentItem } from '@rytass/payments';

import { isValidVATNumber } from './utils/is-valid-vat-number';

// Support for older versions
export const verifyVatNumber = (...args: Parameters<typeof isValidVATNumber>): ReturnType<typeof isValidVATNumber> => {
  console.warn(
    `[DEPRECATION] 'verifyVatNumber' is deprecated and will be removed in future versions. Please use 'isValidVATNumber' instead.`,
  );

  return isValidVATNumber(...args);
};
