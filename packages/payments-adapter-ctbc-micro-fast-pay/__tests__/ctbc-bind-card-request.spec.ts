import { PaymentEvents } from '@rytass/payments';
import { CTBCBindCardRequest } from '../src/ctbc-bind-card-request';
import { CTBCPayment } from '../src/ctbc-payment';

jest.mock('../src/ctbc-crypto', () => ({
  encodeRequestPayload: jest.fn(() => 'encodedPayload'),
  toTxnPayload: jest.fn((value: unknown) => value),
}));

describe('CTBCBindCardRequest', () => {
  const gateway = new CTBCPayment({
    merchantId: 'MER123',
    merId: 'MER123',
    txnKey: 'txn-key-1234567890123',
    terminalId: 'TERM123',
  });

  const payload = {
    MerID: 'MER123',
    MemberID: 'MEM1',
    RequestNo: 'REQ1',
    TokenURL: 'https://callback',
  };

  it('generates form only once and updates state', () => {
    const req = new CTBCBindCardRequest(payload, gateway);

    expect(req.state).toBe('INITED');
    expect(req.form).toEqual({ reqjsonpwd: 'encodedPayload' });
    expect(req.state).toBe('FORM_GENERATED');
    expect(() => req.form).toThrow('Form already used');
  });

  it('provides auto-submitting HTML form', () => {
    const req = new CTBCBindCardRequest(payload, gateway);
    const html = req.formHTML;

    expect(html).toContain('form name="fm"');
    expect(html).toContain('encodedPayload');
    expect(req.state).toBe('FORM_GENERATED');
  });

  it('transitions to bound state and emits event', () => {
    const req = new CTBCBindCardRequest(payload, gateway);
    const eventSpy = jest.fn();

    gateway.emitter.on(PaymentEvents.CARD_BOUND, eventSpy);

    req.bound({ cardToken: 'CARD123', cardNoMask: '123456******7890', requestNo: 'REQ1' });

    expect(req.cardId).toBe('CARD123');
    expect(req.cardNumberPrefix).toBe('123456');
    expect(req.cardNumberSuffix).toBe('7890');
    expect(req.state).toBe('BOUND');
    expect(eventSpy).toHaveBeenCalledWith(req);
  });

  it('records failure and exposes failed message', () => {
    const req = new CTBCBindCardRequest(payload, gateway);
    const eventSpy = jest.fn();

    gateway.emitter.on(PaymentEvents.CARD_BINDING_FAILED, eventSpy);

    req.fail('E001', 'Failed');

    expect(req.failedMessage).toEqual({ code: 'E001', message: 'Failed' });
    expect(req.state).toBe('FAILED');
    expect(eventSpy).toHaveBeenCalledWith(req);
  });

  it('rejects expireDate when binding date is missing', async () => {
    const req = new CTBCBindCardRequest(payload, gateway);

    await expect(req.expireDate).rejects.toThrow('expireDate not available');
  });

  it('returns the original payload via payload getter', () => {
    const req = new CTBCBindCardRequest(payload, gateway);

    expect(req.payload).toEqual(payload);
    expect(req.payload.MerID).toBe('MER123');
    expect(req.payload.MemberID).toBe('MEM1');
    expect(req.payload.RequestNo).toBe('REQ1');
    expect(req.payload.TokenURL).toBe('https://callback');
  });

  it('returns bindingDate after successful binding', () => {
    const req = new CTBCBindCardRequest(payload, gateway);

    expect(req.bindingDate).toBeUndefined();

    req.bound({ cardToken: 'CARD123', cardNoMask: '123456******7890', requestNo: 'REQ1' });

    expect(req.bindingDate).toBeInstanceOf(Date);
  });

  it('resolves expireDate when binding date is available', async () => {
    const req = new CTBCBindCardRequest(payload, gateway);

    req.bound({ cardToken: 'CARD123', cardNoMask: '123456******7890', requestNo: 'REQ1' });

    const expireDate = await req.expireDate;

    expect(expireDate).toBeInstanceOf(Date);
  });

  it('returns null from failedMessage when no failure occurred', () => {
    const req = new CTBCBindCardRequest(payload, gateway);

    expect(req.failedMessage).toBeNull();
  });

  it('returns memberId from payload', () => {
    const req = new CTBCBindCardRequest(payload, gateway);

    expect(req.memberId).toBe('MEM1');
  });

  it('does not set card prefix/suffix when cardNoMask is too short', () => {
    const req = new CTBCBindCardRequest(payload, gateway);

    req.bound({ cardToken: 'CARD456', cardNoMask: '1234', requestNo: 'REQ2' });

    expect(req.cardId).toBe('CARD456');
    expect(req.cardNumberPrefix).toBeUndefined();
    expect(req.cardNumberSuffix).toBeUndefined();
  });

  it('does not set card prefix/suffix when cardNoMask is undefined', () => {
    const req = new CTBCBindCardRequest(payload, gateway);

    req.bound({ cardToken: 'CARD789', requestNo: 'REQ3' });

    expect(req.cardId).toBe('CARD789');
    expect(req.cardNumberPrefix).toBeUndefined();
    expect(req.cardNumberSuffix).toBeUndefined();
  });
});
