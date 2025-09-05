export const TAIWAN_PHONE_NUMBER_RE = /^(0|\+?886-?)9\d{2}-?\d{3}-?\d{3}$/;

export function normalizedTaiwanMobilePhoneNumber(mobile: string): string {
  return mobile.replace(/[^0-9]/g, '').replace(/^886/, '0');
}
