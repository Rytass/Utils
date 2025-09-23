jest.mock('node:crypto', () => {
  const actual = jest.requireActual('node:crypto');

  return {
    __esModule: true,
    ...actual,
    randomBytes: jest.fn((size: number) => Buffer.alloc(size, 1)),
    createDecipheriv: jest.fn(() => ({
      setAutoPadding: jest.fn(),
      update: jest.fn(() => Buffer.from('mock-update')),
      final: jest.fn(() => Buffer.from('mock-final')),
    })),
  };
});

jest.mock('../src/ctbc-crypto-core', () => ({
  __esModule: true,
  getMacFromParams: jest.fn(() => '0'.repeat(64)),
  desMac: jest.fn(() => 'DES_MAC_VALUE'),
  getDivKey: jest.fn(() => Buffer.alloc(24, 1)),
  getMAC: jest.fn(() => 'MAC_DATA'),
  encrypt3DES: jest.fn(() => Buffer.from('encrypted-payload', 'utf8')),
  decrypt3DES: jest.fn(() => 'StatusCode=I0000&StatusDesc=OK&RequestNo=REQ1'),
}));

jest.mock('../src/ctbc-crypto', () => ({
  __esModule: true,
  encodeRequestPayload: jest.fn(() => 'encodedPayload'),
  toTxnPayload: jest.fn((value: unknown) => value),
}));

jest.mock('../src/ctbc-pos-api-utils', () => ({
  posApiQuery: jest.fn(),
}));

import { CardType, PaymentEvents } from '@rytass/payments';
import iconv from 'iconv-lite';
import { CtbcPaymentFailedError } from '../src/errors';
import { CTBCBindCardRequest } from '../src/ctbc-bind-card-request';
import { CTBCPayment } from '../src/ctbc-payment';
import { CTBCOrder } from '../src/ctbc-order';
import { posApiQuery } from '../src/ctbc-pos-api-utils';
import { decrypt3DES } from '../src/ctbc-crypto-core';
import type { OrderCache, CTBCOrderCommitMessage } from '../src/typings';

const mockedPosQuery = posApiQuery as jest.MockedFunction<typeof posApiQuery>;
const mockedDecrypt = decrypt3DES as jest.MockedFunction<typeof decrypt3DES>;

const baseOptions = {
  merchantId: 'MER1',
  merId: 'MER1',
  txnKey: '123456789012345678901234',
  terminalId: 'TERM1',
};

describe('CTBCPayment core behaviours', () => {
  const fetchMock = jest.fn();

  beforeAll(() => {
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fetchMock.mockReset();
    mockedPosQuery.mockReset();
    mockedDecrypt.mockReset();
    mockedDecrypt.mockReturnValue('StatusCode=I0000&StatusDesc=OK&RequestNo=REQ1');
  });

  it('prepareBindCard throws when gateway not ready', async () => {
    const payment = new CTBCPayment(baseOptions);

    (payment as unknown as { isGatewayReady: boolean }).isGatewayReady = false;

    await expect(payment.prepareBindCard('MEM1')).rejects.toThrow('Please waiting gateway ready');
  });

  it('prepareBindCard stores request and formats payload', async () => {
    const setMock = jest.fn();
    const payment = new CTBCPayment({
      ...baseOptions,
      bindCardRequestsCache: {
        get: jest.fn(),
        set: setMock,
      },
    });

    const request = await payment.prepareBindCard('MEM1', {
      requestId: 'REQ1',
      finishRedirectURL: 'https://finish',
    });

    expect(request.memberId).toBe('MEM1');
    expect(setMock).toHaveBeenCalledWith('REQ1', expect.any(Object));
    expect(request.form).toEqual({ reqjsonpwd: 'encodedPayload' });
  });

  it('prepare validates order id and amount', async () => {
    const payment = new CTBCPayment(baseOptions);

    await expect(
      payment.prepare({
        id: 'A'.repeat(20),
        items: [{ name: 'item', unitPrice: 10, quantity: 1 }],
      }),
    ).rejects.toThrow('Order ID must be less than 20 characters');

    await expect(
      payment.prepare({
        id: 'INVALID#',
        items: [{ name: 'item', unitPrice: 10, quantity: 1 }],
      }),
    ).rejects.toThrow('Order ID can only contain alphanumeric characters and underscores');

    await expect(
      payment.prepare({
        id: 'VALID',
        items: [{ name: 'item', unitPrice: 0, quantity: 1 }],
      }),
    ).rejects.toThrow('Total price must be greater than 0');
  });

  it('prepare builds CTBCOrder and caches it', async () => {
    const orderSet = jest.fn();
    const payment = new CTBCPayment({
      ...baseOptions,
      orderCache: {
        get: jest.fn(),
        set: orderSet,
      },
    });

    const order = await payment.prepare({
      items: [
        { name: '商品一', unitPrice: 50, quantity: 1 },
        { name: '商品二', unitPrice: 25, quantity: 2 },
      ],
      cardType: CardType.AE,
      clientBackUrl: 'https://client-back',
      shopName: '店家名稱',
    });

    expect(orderSet).toHaveBeenCalledWith(expect.any(String), expect.any(CTBCOrder));
    expect(order).toBeInstanceOf(CTBCOrder);
  });

  it('query handles AMEX flag and cached orders', async () => {
    const amexPayment = new CTBCPayment({ ...baseOptions, isAmex: true });

    await expect(amexPayment.query('ORDER1')).rejects.toThrow('Query AMEX Order From SOAP API is not implemented');

    const cachedPayment = new CTBCPayment(baseOptions);
    const cachedOrder = await cachedPayment.prepare({
      id: 'ORDER2',
      items: [{ name: 'item', unitPrice: 100, quantity: 1 }],
    });

    const payment = new CTBCPayment({
      ...baseOptions,
      orderCache: {
        get: jest.fn().mockResolvedValue(cachedOrder),
        set: jest.fn(),
      },
    });

    mockedPosQuery.mockResolvedValue({ ErrCode: '00', RespCode: '0', QueryCode: '1', CurrentState: '' });
    await payment.query('ORDER2');
    expect(mockedPosQuery).toHaveBeenCalled();
  });

  it('query propagates POS gateway errors', async () => {
    const payment = new CTBCPayment(baseOptions);

    mockedPosQuery.mockResolvedValueOnce(123);
    await expect(payment.query('ERR1')).rejects.toThrow('Query failed with error code: 123');

    mockedPosQuery.mockResolvedValueOnce({ ErrCode: '01', ERRDESC: 'oops', RespCode: '1', CurrentState: '' });
    await expect(payment.query('ERR2')).rejects.toThrow('Query failed: 01 - oops');
  });

  it('query reconstructs order from POS response', async () => {
    const orderSet = jest.fn();
    const payment = new CTBCPayment({
      ...baseOptions,
      orderCache: {
        get: jest.fn().mockResolvedValue(undefined),
        set: orderSet,
      },
    });

    mockedPosQuery.mockResolvedValue({
      ErrCode: '00',
      RespCode: '0',
      QueryCode: '1',
      AuthAmt: '901 200 0',
      AuthCode: 'AUTH',
      PAN: '400361******7729',
      ECI: '05',
      XID: 'XID123',
      CurrentState: '0',
    });

    const order = await payment.query('ORDER_POS');

    expect(order).toBeInstanceOf(CTBCOrder);
    expect(orderSet).toHaveBeenCalledWith('ORDER_POS', expect.any(CTBCOrder));
  });

  it('checkoutWithBoundCard validates inputs and posts payload', async () => {
    const payment = new CTBCPayment(baseOptions);

    fetchMock.mockResolvedValue({ ok: true });

    await expect(
      payment.checkoutWithBoundCard({
        orderId: 'A'.repeat(20),
        memberId: 'MEM',
        cardId: 'CARD',
        items: [{ name: 'i', unitPrice: 100, quantity: 1 }],
      }),
    ).rejects.toThrow('Order ID must be less than 20 characters');

    await expect(
      payment.checkoutWithBoundCard({
        orderId: 'INV@',
        memberId: 'MEM',
        cardId: 'CARD',
        items: [{ name: 'i', unitPrice: 100, quantity: 1 }],
      }),
    ).rejects.toThrow('Order ID can only contain alphanumeric characters and underscores');

    await expect(
      payment.checkoutWithBoundCard({
        memberId: 'MEM',
        cardId: 'CARD',
        items: [{ name: 'i', unitPrice: 0, quantity: 1 }],
      }),
    ).rejects.toThrow('Total price must be greater than 0');

    await payment.checkoutWithBoundCard({
      memberId: 'MEM',
      cardId: 'CARD',
      items: [{ name: 'i', unitPrice: 100, quantity: 1 }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/mFastPay/TxnServlet'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('handleCallbackTextBodyByURLPath resolves success and redirect', async () => {
    const payment = new CTBCPayment(baseOptions);
    const orderStub = {
      id: 'ORDER_OK',
      cardType: CardType.VMJ,
      clientBackUrl: 'https://back',
      commit: jest.fn(),
      fail: jest.fn(),
    } as unknown as CTBCOrder;

    (payment as unknown as { orderCache: OrderCache<CTBCOrderCommitMessage> }).orderCache = {
      get: jest.fn().mockResolvedValue(orderStub),
      set: jest.fn(),
    };

    jest
      .spyOn(iconv, 'decode')
      .mockReturnValue(
        'lidm=ORDER_OK&errcode=00&authAmt=100&authCode=AUTH&CardNumber=1234560000007890&Last4digitPAN=7890&XID=XYZ',
      );

    const response = await payment.handleCallbackTextBodyByURLPath(
      '/payments/ctbc/callback',
      `URLResEnc=${Buffer.from('ignored').toString('hex')}`,
    );

    expect(response).toEqual({ status: 302, headers: { Location: 'https://back' } });
  });

  it('handleCallbackTextBodyByURLPath handles failure case', async () => {
    const payment = new CTBCPayment(baseOptions);
    const orderStub = {
      id: 'ORDER_FAIL',
      cardType: CardType.VMJ,
      clientBackUrl: undefined,
      commit: jest.fn(),
      fail: jest.fn(),
    } as unknown as CTBCOrder;

    (payment as unknown as { orderCache: OrderCache<CTBCOrderCommitMessage> }).orderCache = {
      get: jest.fn().mockResolvedValue(orderStub),
      set: jest.fn(),
    };

    jest.spyOn(iconv, 'decode').mockReturnValue('lidm=ORDER_FAIL&errcode=99&errDesc=Oops');

    await expect(
      payment.handleCallbackTextBodyByURLPath(
        '/payments/ctbc/callback',
        `URLResEnc=${Buffer.from('ignored').toString('hex')}`,
      ),
    ).rejects.toThrow(CtbcPaymentFailedError);

    expect(orderStub.fail).toHaveBeenCalledWith('99', 'Oops');
  });

  it('handleCallbackTextBodyByURLPath throws when missing URLResEnc', async () => {
    const payment = new CTBCPayment(baseOptions);

    await expect(payment.handleCallbackTextBodyByURLPath('/payments/ctbc/callback', '')).rejects.toThrow(
      'Missing URLResEnc parameter in callback',
    );
  });

  it('handleCallbackTextBodyByURLPath processes bind card callback', async () => {
    const payment = new CTBCPayment(baseOptions);
    const request = new CTBCBindCardRequest(
      {
        MerID: 'MER1',
        MemberID: 'MEM',
        RequestNo: 'REQ1',
        TokenURL: 'https://token',
      },
      payment,
    );

    const boundSpy = jest.fn();

    payment.emitter.on(PaymentEvents.CARD_BOUND, boundSpy);

    (payment as unknown as { bindCardRequestsCache: unknown }).bindCardRequestsCache = {
      get: jest.fn().mockResolvedValue(request),
      set: jest.fn(),
    };

    mockedDecrypt.mockReturnValue(
      'StatusCode=I0000&StatusDesc=OK&RequestNo=REQ1&CardToken=TOKEN123&CardNoMask=123456-******-7890',
    );

    const encoded = encodeURIComponent(JSON.stringify({ Response: { Data: { MAC: 'mac', TXN: 'abcd' } } }));

    const result = await payment.handleCallbackTextBodyByURLPath('/payments/ctbc/bound-card', `rspjsonpwd=${encoded}`);

    expect(result.status).toBe(200);
    expect(boundSpy).toHaveBeenCalled();
  });

  it('handleCallbackTextBodyByURLPath propagates bind card failure', async () => {
    const payment = new CTBCPayment(baseOptions);
    const request = new CTBCBindCardRequest(
      {
        MerID: 'MER1',
        MemberID: 'MEM',
        RequestNo: 'REQ1',
        TokenURL: 'https://token',
      },
      payment,
    );

    const failSpy = jest.spyOn(request, 'fail');

    (payment as unknown as { bindCardRequestsCache: unknown }).bindCardRequestsCache = {
      get: jest.fn().mockResolvedValue(request),
      set: jest.fn(),
    };

    mockedDecrypt.mockReturnValue('StatusCode=FAIL&StatusDesc=Bad&RequestNo=REQ1');

    const encoded = encodeURIComponent(JSON.stringify({ Response: { Data: { MAC: 'mac', TXN: 'abcd' } } }));

    await expect(
      payment.handleCallbackTextBodyByURLPath('/payments/ctbc/bound-card', `rspjsonpwd=${encoded}`),
    ).rejects.toThrow('CTBC Bind Card Failed: FAIL - Bad');

    expect(failSpy).toHaveBeenCalledWith('FAIL', 'Bad');
  });

  it('handleCallbackTextBodyByURLPath processes bound checkout callback', async () => {
    const payment = new CTBCPayment(baseOptions);
    const orderStub = {
      id: 'BOUND_OK',
      cardType: CardType.VMJ,
      commit: jest.fn(),
      fail: jest.fn(),
    } as unknown as CTBCOrder;

    (payment as unknown as { orderCache: OrderCache<CTBCOrderCommitMessage> }).orderCache = {
      get: jest.fn().mockResolvedValue(orderStub),
      set: jest.fn(),
    };

    mockedDecrypt.mockReturnValue('StatusCode=I0000&StatusDesc=OK&RequestNo=BOUND_OK&AuthAmount=100');

    const encoded = encodeURIComponent(JSON.stringify({ Response: { Data: { MAC: 'mac', TXN: 'abcd' } } }));

    const res = await payment.handleCallbackTextBodyByURLPath('/payments/ctbc/bound-card/checkout-result', encoded);

    expect(res.status).toBe(200);
    expect(orderStub.commit).toHaveBeenCalledWith({
      id: 'BOUND_OK',
      totalPrice: 100,
      committedAt: expect.any(Date),
    });
  });

  it('handleCallbackTextBodyByURLPath throws on bound checkout failure', async () => {
    const payment = new CTBCPayment(baseOptions);
    const orderStub = {
      id: 'BOUND_FAIL',
      cardType: CardType.VMJ,
      commit: jest.fn(),
      fail: jest.fn(),
    } as unknown as CTBCOrder;

    (payment as unknown as { orderCache: OrderCache<CTBCOrderCommitMessage> }).orderCache = {
      get: jest.fn().mockResolvedValue(orderStub),
      set: jest.fn(),
    };

    mockedDecrypt.mockReturnValue('StatusCode=F0001&StatusDesc=Bad&RequestNo=BOUND_FAIL');

    const encoded = encodeURIComponent(JSON.stringify({ Response: { Data: { MAC: 'mac', TXN: 'abcd' } } }));

    await expect(
      payment.handleCallbackTextBodyByURLPath('/payments/ctbc/bound-card/checkout-result', encoded),
    ).rejects.toThrow('CTBC Bound Card Checkout Failed: F0001 - Bad');

    expect(orderStub.fail).toHaveBeenCalledWith('F0001', 'Bad');
  });
});
