import { LRUCache } from 'lru-cache';
import { NewebPayPayment, NewebPaymentChannel, NewebPayOrder, NewebPayCommitMessage } from '../src';

const MERCHANT_ID = 'MS154366906';
const AES_KEY = 'X4vM1RymaxkyzZ9mZHNE67Kba2gpv40c';
const AES_IV = '6ma4zu0UFWk54oyX';

describe('NewebPay Custom Order Cache', () => {
  it('should use custom order cache', async () => {
    const lruCache = new LRUCache<string, NewebPayOrder<NewebPayCommitMessage>>({
      ttlAutopurge: true,
      ttl: 10 * 60 * 1000, // default: 10 mins
    });

    const payment = new NewebPayPayment({
      merchantId: MERCHANT_ID,
      aesKey: AES_KEY,
      aesIv: AES_IV,
      ordersCache: {
        get: async (key: string): Promise<NewebPayOrder<NewebPayCommitMessage> | undefined> => lruCache!.get(key),
        set: async (key: string, value: NewebPayOrder<NewebPayCommitMessage>): Promise<void> => {
          lruCache!.set(key, value);
        },
      },
    });

    await payment.prepare({
      channel: NewebPaymentChannel.CREDIT,
      items: [
        {
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        },
        {
          name: '中文',
          unitPrice: 15,
          quantity: 4,
        },
      ],
    });

    expect(lruCache.size).toBe(1);
  });
});
