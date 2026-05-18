import { createHash } from 'crypto';

export function ecpayUrlEncode(raw: string): string {
  return encodeURIComponent(raw).toLowerCase().replace(/'/g, '%27').replace(/~/g, '%7e').replace(/%20/g, '+');
}

export function ecpaySha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex').toUpperCase();
}
