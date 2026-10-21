const WEIGHTS = [1, 2, 1, 2, 1, 2, 4, 1] as const;

const digitSum = (value: number): number =>
  String(value)
    .split('')
    .reduce((sum, digit) => sum + Number(digit), 0);

/**
 * 營利事業統一編號檢查碼：各位數乘上權數 1,2,1,2,1,2,4,1 後取各乘積的位數和相加，
 * 總和可被 5 整除即合法；第 7 碼為 7 時，總和加 1 可被 5 整除也合法。
 */
export const isTaxIdValid = (taxId: string): boolean => {
  if (!/^\d{8}$/.test(taxId)) return false;

  const digits = taxId.split('').map(Number);
  const sum = digits.reduce((total, digit, index) => total + digitSum(digit * WEIGHTS[index]), 0);

  if (sum % 5 === 0) return true;

  return digits[6] === 7 && (sum + 1) % 5 === 0;
};
