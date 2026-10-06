import { isIP } from 'node:net';

/**
 * Drop an IPv6 zone index (`fe80::1%en0` → `fe80::1`).
 *
 * The zone names an interface on the machine that received the connection; it
 * means nothing anywhere else, and neither `inet` nor `cidr` accepts it.
 */
export const stripIpZone = (ip: string): string => {
  const zone = ip.indexOf('%');

  return zone === -1 ? ip : ip.slice(0, zone);
};

/**
 * Format an address for the `inet`/`cidr` column the login log stores it in.
 *
 * The suffix is the full prefix length for the family, which is what "this one
 * address" means: /32 for IPv4 and /128 for IPv6. Appending /32 to an IPv6
 * address instead describes a /32 network and Postgres rejects it, so a single
 * login from an IPv6 client used to abort the write. A zone index is dropped
 * for the same reason.
 */
export const toInetCidr = (ip: string): string => {
  const address = stripIpZone(ip);

  return `${address}/${address.includes(':') ? 128 : 32}`;
};

/**
 * `toInetCidr` for a value that may not be an address at all, or null.
 *
 * `req.ip` is whatever the HTTP stack and any proxy in front of it produced.
 * Writing something Postgres refuses would fail the write it is part of, and
 * recording an address is never worth that.
 */
export const toStorableCidr = (ip: string | null | undefined): string | null =>
  ip && isIP(stripIpZone(ip)) ? toInetCidr(ip) : null;
