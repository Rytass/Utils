import { LRUCache } from 'lru-cache';
import { Channel, ECPayChannelCreditCard, ECPayOrderItem, ECPayPayment } from '../src';

describe('ECPayOrder Custom Order Cache', () => {
  it('should use custom order cache', async () => {
    const lruCache = new LRUCache<string, any>({
      ttlAutopurge: true,
      ttl: 10 * 60 * 1000, // default: 10 mins
    });

    const payment = new ECPayPayment({
      ordersCache: {
        get: async (key: string) => lruCache!.get(key),
        set: async (key: string, value: any) => {
          lruCache!.set(key, value);
        },
      },
    });

    await payment.prepare<ECPayChannelCreditCard>({
      channel: Channel.CREDIT_CARD,
      items: [
        new ECPayOrderItem({
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }),
        new ECPayOrderItem({
          name: '中文',
          unitPrice: 15,
          quantity: 4,
        }),
      ],
    });

    expect(lruCache.size).toBe(1);
  });
});
