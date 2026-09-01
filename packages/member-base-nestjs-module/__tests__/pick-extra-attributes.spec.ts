import { pickExtraAttributes } from '../src/utils/pick-extra-attributes';

describe('pickExtraAttributes', () => {
  it('should return nothing when no attributes were asked for', () => {
    expect(pickExtraAttributes({ employeeId: 'E-1' })).toEqual({});
    expect(pickExtraAttributes({ employeeId: 'E-1' }, [])).toEqual({});
  });

  it('should return only the attributes that were asked for', () => {
    const picked = pickExtraAttributes({ employeeId: 'E-1', costCenter: 'CC-9', userPrincipalName: 'wang@corp.com' }, [
      'employeeId',
    ]);

    expect(picked).toEqual({ employeeId: 'E-1' });
  });

  it('should omit an attribute the entry does not carry, rather than set it undefined', () => {
    const picked = pickExtraAttributes({ employeeId: 'E-1' }, ['employeeId', 'costCenter']);

    // `'costCenter' in attributes` has to answer "was it reported", so a
    // consumer can tell an unpopulated field from one a delta page omitted.
    expect('costCenter' in picked).toBe(false);
    expect(picked).toEqual({ employeeId: 'E-1' });
  });

  it('should keep an attribute the directory reported as null or empty', () => {
    // Reported-as-empty is a fact about the directory; dropping it would make
    // "cleared upstream" indistinguishable from "never asked for".
    const picked = pickExtraAttributes({ employeeId: null, costCenter: '' }, ['employeeId', 'costCenter']);

    expect(picked).toEqual({ employeeId: null, costCenter: '' });
  });

  it('should pass values through without interpreting them', () => {
    const orgData = { division: 'Hardware', costCenter: '4711' };

    const picked = pickExtraAttributes(
      { employeeOrgData: orgData, proxyAddresses: ['smtp:a@corp.com', 'smtp:b@corp.com'], employeeHireDate: 1 },
      ['employeeOrgData', 'proxyAddresses', 'employeeHireDate'],
    );

    // An object stays an object and a multi-valued attribute stays an array:
    // which of those a given field is belongs to the directory's schema, not to
    // this module.
    expect(picked.employeeOrgData).toBe(orgData);
    expect(picked.proxyAddresses).toEqual(['smtp:a@corp.com', 'smtp:b@corp.com']);
    expect(picked.employeeHireDate).toBe(1);
  });

  it('should not reach up the prototype chain for an attribute name', () => {
    // `'toString' in entry` is true for any object literal; a caller asking for
    // an attribute the directory never sent must not receive Object.prototype.
    expect(pickExtraAttributes({ employeeId: 'E-1' }, ['toString', 'constructor'])).toEqual({});
  });
});
