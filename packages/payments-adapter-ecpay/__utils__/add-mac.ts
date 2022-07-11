import { createHash } from 'crypto';

export function addMac(payload: Record<string, string>) {
  const mac = createHash('sha256')
    .update(
      encodeURIComponent(
        [
          ['HashKey', '5294y06JbISpM5x9'],
          ...Object.entries(payload).sort(([aKey], [bKey]) => (aKey.toLowerCase() < bKey.toLowerCase() ? -1 : 1)),
          ['HashIV', 'v77hoKGq4kWxNNIS'],
        ]
          .map(([key, value]) => `${key}=${value}`)
          .join('&'),
      )
        .toLowerCase()
        .replace(/'/g, '%27')
        .replace(/~/g, '%7e')
        .replace(/%20/g, '+'),
    )
    .digest('hex')
    .toUpperCase();

  return {
    ...payload,
    CheckMacValue: mac,
  } as Record<string, string>;
}
