/**
 * @jest-environment node
 */

import { NewebPayPayment } from '../src';
import axios from 'axios';

const MERCHANT_ID = 'MS154366906';
const AES_KEY = 'X4vM1RymaxkyzZ9mZHNE67Kba2gpv40c';
const AES_IV = '6ma4zu0UFWk54oyX';

describe('NewebPay API request User-Agent', () => {
  const payment = new NewebPayPayment({
    merchantId: MERCHANT_ID,
    aesKey: AES_KEY,
    aesIv: AES_IV,
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // NewebPay's edge (Akamai) returns 403 Access Denied for axios's default
  // `axios/<version>` User-Agent. Every API POST must send an explicit UA.
  it('sends an explicit User-Agent on QueryTradeInfo', async () => {
    const mockedPost = jest.spyOn(axios, 'post').mockResolvedValue({ data: { Status: 'X', Result: {} } } as never);

    // query() triggers the API POST; ignore the downstream CheckCode
    // validation throw — we only assert the request carried the UA header.
    await payment.query('order-1', 100).catch(() => undefined);

    expect(mockedPost).toHaveBeenCalled();
    expect(mockedPost.mock.calls[0]?.[2]).toMatchObject({
      headers: { 'User-Agent': 'rytass-payments-adapter-newebpay' },
    });
  });
});
