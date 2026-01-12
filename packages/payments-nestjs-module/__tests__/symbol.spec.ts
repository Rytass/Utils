import { PAYMENTS_MODULE_OPTIONS, PAYMENTS_GATEWAY } from '../src/typings/symbol';

describe('Symbol exports', () => {
  it('should export PAYMENTS_MODULE_OPTIONS as a Symbol', () => {
    expect(typeof PAYMENTS_MODULE_OPTIONS).toBe('symbol');
    expect(PAYMENTS_MODULE_OPTIONS.toString()).toBe('Symbol(PAYMENTS_MODULE_OPTIONS)');
  });

  it('should export PAYMENTS_GATEWAY as a Symbol', () => {
    expect(typeof PAYMENTS_GATEWAY).toBe('symbol');
    expect(PAYMENTS_GATEWAY.toString()).toBe('Symbol(PAYMENTS_GATEWAY)');
  });

  it('should export unique symbols', () => {
    expect(PAYMENTS_MODULE_OPTIONS).not.toBe(PAYMENTS_GATEWAY);
  });
});
