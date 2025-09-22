import crypto from 'node:crypto';
import {
  decrypt3DES,
  desEcbEncryptHex,
  desMac,
  encrypt3DES,
  getDivKey,
  getMAC,
  getTXN,
  setIV,
  setSSLAuthIV,
} from '../src/ctbc-crypto-core';

describe('ctbc-crypto-core helpers', () => {
  afterEach(() => {
    // restore defaults between tests
    setIV(Buffer.alloc(8, 0));
    setSSLAuthIV(Buffer.from('hywebpg5', 'utf8'));
  });

  it('setIV should require 8-byte buffer', () => {
    expect(() => setIV(Buffer.alloc(8, 1))).not.toThrow();
    expect(() => setIV(Buffer.from([1, 2, 3]))).toThrow('IV must be 8 bytes');
  });

  it('setSSLAuthIV should require 8-byte buffer', () => {
    expect(() => setSSLAuthIV(Buffer.alloc(8, 2))).not.toThrow();
    expect(() => setSSLAuthIV(Buffer.from([3, 4, 5]))).toThrow('SSLAuth IV must be 8 bytes');
  });

  it('encrypt3DES and decrypt3DES should round-trip text', () => {
    const key = crypto.randomBytes(24);
    const input = 'Hello CTBC! 測試';

    const encrypted = encrypt3DES(input, key);
    const decrypted = decrypt3DES(encrypted, key);

    expect(decrypted).toBe(input);
  });

  it('getDivKey should derive deterministic key using XOR halves', () => {
    const key = '123456789012345678901234';
    const divKey1 = getDivKey(key);
    const divKey2 = getDivKey(key);

    expect(divKey1.equals(divKey2)).toBe(true);
    expect(divKey1).toHaveLength(24);
  });

  it('getTXN and getDecTXN should be reversible', () => {
    const key = 'abcdefghijklmnopqrstuvwx';
    const input = 'MerchantID=1234&TerminalID=5678';

    const txn = getTXN(input, key);
    const decrypted = decrypt3DES(Buffer.from(txn, 'hex'), getDivKey(key));

    expect(txn).toMatch(/^[0-9A-F]+$/);
    expect(decrypted).toBe(input);
  });

  it('getMAC returns last 8 hex chars of second encryption', () => {
    const key = 'abcdefghijklmnopqrstuvwx';
    const input = 'test-mac-input';

    const mac = getMAC(input, key);

    expect(mac).toHaveLength(8);
    expect(mac).toMatch(/^[0-9A-F]+$/);
  });

  it('desMac uses SSLAuthIV and outputs upper-case hex', () => {
    setSSLAuthIV(Buffer.alloc(8, 7));
    const mac = desMac(Buffer.from('payload'), '123456789012345678901234');

    expect(mac).toMatch(/^[0-9A-F]+$/);
  });

  it('desEcbEncryptHex rejects invalid key length', () => {
    expect(() => desEcbEncryptHex('data', '123456')).toThrow('Invalid 3DES key length (must be 8 or 24 chars)');
  });

  it('desEcbEncryptHex pads to multiple of 8 and encrypts with provided key', () => {
    const cipherHex = desEcbEncryptHex('123456781', '12345678');

    expect(cipherHex).toMatch(/^[0-9A-F]+$/);
    expect(cipherHex.length % 16).toBe(0);
  });
});
