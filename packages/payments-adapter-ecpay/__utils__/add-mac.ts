import { createHash } from 'crypto';

export const getAddMac: (hashKey?: string, hashIv?: string) => (payload: Record<string, string>) => Record<string, string> = (hashKey = '5294y06JbISpM5x9', hashIv = 'v77hoKGq4kWxNNIS') => (payload: Record<string, string>) => {
  const mac = createHash('sha256')
    .update(
      encodeURIComponent(
        [
          ['HashKey', hashKey],
          ...Object.entries(payload).sort(([aKey], [bKey]) => (aKey.toLowerCase() < bKey.toLowerCase() ? -1 : 1)),
          ['HashIV', hashIv],
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
