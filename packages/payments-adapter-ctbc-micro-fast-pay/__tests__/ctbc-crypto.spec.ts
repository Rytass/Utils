jest.mock('../src/ctbc-crypto-core', () => ({
  encrypt3DES: jest.fn().mockReturnValue(Buffer.from('encrypted', 'utf8')),
  getMAC: jest.fn().mockReturnValue('mockedMAC'),
  getDivKey: jest.fn().mockReturnValue(Buffer.alloc(24, 1)),
}));

import { encodeRequestPayload, toTxnPayload } from '../src/ctbc-crypto';
import { encrypt3DES, getMAC } from '../src/ctbc-crypto-core';

describe('ctbc-crypto utilities', () => {
  const gateway = { merchantId: 'MER123', txnKey: 'KEY1234567890123456789012' };

  it('toTxnPayload should cast object to CTBCTxnPayload', () => {
    const source = { foo: 'bar', baz: 1 };

    expect(toTxnPayload(source)).toBe(source as unknown);
  });

  it('encodeRequestPayload sorts keys and encodes as url encoded JSON', () => {
    const payload = {
      b: '2',
      a: '1',
      c: undefined,
    };

    const encoded = encodeRequestPayload('ServiceX', payload, gateway);
    const decodedJSON = JSON.parse(decodeURIComponent(encoded));

    expect(decodedJSON.Request.Header.ServiceName).toBe('ServiceX');
    expect(decodedJSON.Request.Header.MerchantID).toBe('MER123');
    expect(decodedJSON.Request.Data.MAC).toBe('mockedMAC');
    expect(decodedJSON.Request.Data.TXN).toBe(Buffer.from('encrypted', 'utf8').toString('hex').toUpperCase());

    expect(getMAC).toHaveBeenCalledWith('a=1&b=2', gateway.txnKey);
    expect(encrypt3DES).toHaveBeenCalled();
  });
});
