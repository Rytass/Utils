/**
 * Hand back the directory attributes the caller asked for, uninterpreted.
 *
 * Every directory provider takes an `extraAttributes` option that widens what
 * it requests from the directory — `$select` for Graph, the attribute list for
 * an LDAP search. This is the other half of that: without it the attributes
 * arrive and are dropped by `toIdentity`, which makes `extraAttributes` a
 * request with no response.
 *
 * Directories carry organisation-specific fields — an employee number, a cost
 * centre, a site code — and what any of them *mean* is the application's
 * business, not this module's. So nothing here is interpreted or renamed: the
 * caller names the attributes and gets back exactly those, under the names the
 * directory used, carrying the values the directory sent. A provider that
 * collapsed a multi-valued LDAP attribute to its first element, or coerced a
 * Graph object to a string, would be deciding on the application's behalf what
 * its own field means.
 *
 * Absent keys are omitted rather than set to `undefined`, for the same reason
 * the mapped fields are left alone on an incremental read: a `/users/delta`
 * entry carries only what changed, and `'employeeId' in attributes` should
 * answer "was it reported" rather than always answering yes.
 *
 * Only own properties are read. `in` would walk the prototype chain, so an
 * `extraAttributes: ['constructor']` — a plausible enough attribute name for
 * some schema — would put `Object` on the identity of every user the directory
 * ever returned.
 */
export const pickExtraAttributes = (
  entry: Record<string, unknown>,
  extraAttributes?: string[],
): Record<string, unknown> => {
  if (!extraAttributes?.length) return {};

  return extraAttributes.reduce<Record<string, unknown>>((picked, attribute) => {
    if (!Object.prototype.hasOwnProperty.call(entry, attribute)) return picked;

    return { ...picked, [attribute]: entry[attribute] };
  }, {});
};
