/**
 * Format an address for the `inet`/`cidr` column the login log stores it in.
 *
 * The suffix is the full prefix length for the family, which is what "this one
 * address" means: /32 for IPv4 and /128 for IPv6. Appending /32 to an IPv6
 * address instead describes a /32 network and Postgres rejects it, so a single
 * login from an IPv6 client used to abort the write.
 */
export const toInetCidr = (ip: string): string => `${ip}/${ip.includes(':') ? 128 : 32}`;
