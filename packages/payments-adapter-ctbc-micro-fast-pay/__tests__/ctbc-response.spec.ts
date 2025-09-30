import { decodeResponsePayload, toStringRecord, validateResponseMAC } from '../src/ctbc-response';
import * as cryptoCore from '../src/ctbc-crypto-core';

describe('ctbc-response helpers', () => {
  it('toStringRecord casts to string map', () => {
    const from = { foo: 'bar' } as const;

    expect(toStringRecord(from)).toEqual({ foo: 'bar' });
  });

  it('validateResponseMAC delegates to getMAC', () => {
    const spy = jest.spyOn(cryptoCore, 'getMAC').mockReturnValue('GOODMAC');

    expect(validateResponseMAC('payload', 'GOODMAC', 'key')).toBe(true);
    expect(validateResponseMAC('payload', 'BAD', 'key')).toBe(false);
    expect(spy).toHaveBeenCalledWith('payload', 'key');

    spy.mockRestore();
  });

  it('decodeResponsePayload returns parsed fields and validates MAC', () => {
    const txnKey = '123456789012345678901234';
    const expectedPlain = 'foo=bar&baz=qux';

    const getDivKeySpy = jest.spyOn(cryptoCore, 'getDivKey').mockReturnValue(Buffer.alloc(24, 1));
    const decryptSpy = jest.spyOn(cryptoCore, 'decrypt3DES').mockReturnValue(expectedPlain);
    const macSpy = jest.spyOn(cryptoCore, 'getMAC').mockReturnValue('VALIDMAC');

    const payload = encodeURIComponent(
      JSON.stringify({
        Response: {
          Data: { MAC: 'VALIDMAC', TXN: 'abcd' },
        },
      }),
    );

    const result = decodeResponsePayload(payload, txnKey);

    expect(result).toEqual({ foo: 'bar', baz: 'qux' });
    expect(getDivKeySpy).toHaveBeenCalledWith(txnKey);
    expect(decryptSpy).toHaveBeenCalled();
    expect(macSpy).toHaveBeenCalledWith(expectedPlain, txnKey);

    getDivKeySpy.mockRestore();
    decryptSpy.mockRestore();
    macSpy.mockRestore();
  });

  it('decodeResponsePayload can skip MAC validation', () => {
    jest.spyOn(cryptoCore, 'getDivKey').mockReturnValue(Buffer.alloc(24, 1));
    jest.spyOn(cryptoCore, 'decrypt3DES').mockReturnValue('foo=bar');
    const macSpy = jest.spyOn(cryptoCore, 'getMAC').mockReturnValue('WRONG');

    const payload = encodeURIComponent(
      JSON.stringify({
        Response: { Data: { MAC: 'NOPE', TXN: 'abcd' } },
      }),
    );

    const result = decodeResponsePayload(payload, 'key', { validateMAC: false });

    expect(result).toEqual({ foo: 'bar' });
    expect(macSpy).not.toHaveBeenCalled();
  });

  it('decodeResponsePayload throws on missing payload', () => {
    expect(() => decodeResponsePayload('', 'key')).toThrow('Missing encoded response payload');
  });

  it('decodeResponsePayload throws on MAC failure', () => {
    jest.spyOn(cryptoCore, 'getDivKey').mockReturnValue(Buffer.alloc(24, 1));
    jest.spyOn(cryptoCore, 'decrypt3DES').mockReturnValue('foo=bar');
    jest.spyOn(cryptoCore, 'getMAC').mockReturnValue('EXPECTED');

    const payload = encodeURIComponent(
      JSON.stringify({
        Response: { Data: { MAC: 'WRONG', TXN: 'abcd' } },
      }),
    );

    expect(() => decodeResponsePayload(payload, 'key')).toThrow('MAC validation failed');
  });
});
