/**
 * Active Directory disables an account with bit 2 of userAccountControl.
 * https://learn.microsoft.com/windows/win32/adschema/a-useraccountcontrol
 */
const ACCOUNTDISABLE_FLAG = 0x0002;

/**
 * Strip a NetBIOS/realm prefix from what the user typed.
 *
 * On a domain-joined Windows machine people habitually type `DOMAIN\account`,
 * but sAMAccountName itself cannot contain a backslash, so passing the input
 * through verbatim finds nothing and the login fails for a valid account.
 * Taking everything after the last separator strips the prefix safely (and
 * tolerates a mistyped forward slash). A UPN (`user@domain.tld`) contains
 * neither separator and passes through untouched.
 */
export const normalizeAccountInput = (raw: string): string => {
  const trimmed = raw.trim();
  const lastSeparatorIndex = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));

  return lastSeparatorIndex === -1 ? trimmed : trimmed.slice(lastSeparatorIndex + 1).trim();
};

/**
 * Escape a value for use inside an LDAP search filter (RFC 4515).
 *
 * Without this an account name containing `*`, `(` or `)` would alter the
 * filter's structure rather than being matched literally.
 */
export const escapeFilterValue = (value: string): string =>
  [...value]
    .map(character => {
      switch (character) {
        case '\\':
          return '\\5c';
        case '*':
          return '\\2a';
        case '(':
          return '\\28';
        case ')':
          return '\\29';
        case '\0':
          return '\\00';
        default:
          return character;
      }
    })
    .join('');

/**
 * Render an objectGUID into the canonical brace-less string form.
 *
 * The directory returns 16 raw bytes whose first three groups are
 * little-endian, which is why this is not a straight hex dump.
 */
export const formatObjectGuid = (value: unknown): string | null => {
  const buffer = Buffer.isBuffer(value) ? value : null;

  if (!buffer || buffer.length !== 16) {
    return typeof value === 'string' && value !== '' ? value : null;
  }

  const hex = (start: number, end: number, reverse: boolean): string => {
    const slice = buffer.subarray(start, end);

    return (reverse ? Buffer.from(slice).reverse() : slice).toString('hex');
  };

  return [hex(0, 4, true), hex(4, 6, true), hex(6, 8, true), hex(8, 10, false), hex(10, 16, false)].join('-');
};

export const isAccountDisabled = (userAccountControl: unknown): boolean => {
  const parsed = Number(userAccountControl);

  return Number.isNaN(parsed) ? false : (parsed & ACCOUNTDISABLE_FLAG) !== 0;
};

/** Extract the CN of each group DN listed in memberOf. */
export const extractGroupNames = (memberOf: unknown): string[] => {
  const entries = Array.isArray(memberOf) ? memberOf : memberOf === undefined || memberOf === null ? [] : [memberOf];

  return entries
    .map(entry => String(entry))
    .map(dn => /^CN=([^,]+)/i.exec(dn)?.[1])
    .filter((name): name is string => typeof name === 'string');
};

export const firstString = (value: unknown): string | undefined => {
  const candidate = Array.isArray(value) ? value[0] : value;

  return typeof candidate === 'string' && candidate !== '' ? candidate : undefined;
};
