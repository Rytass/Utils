import { LRUCache } from 'lru-cache';
import { HwaNanPayment } from '../src';

const MERCHANT_ID = '326650918560582';
const TERMINAL_ID = '87345985';
const MER_ID = '22343';
const IDENTIFIER = '8949bf87c8d710a0';

describe('HwaNan Custom Order Cache', () => {
  it('should use custom order cache', async () => {
    const lruCache = new LRUCache<string, any>({
      ttlAutopurge: true,
      ttl: 10 * 60 * 1000, // default: 10 mins
    });

    const payment = new HwaNanPayment({
      merchantId: MERCHANT_ID,
      terminalId: TERMINAL_ID,
      merID: MER_ID,
      merchantName: 'Rytass Shop',
      identifier: IDENTIFIER,
      ordersCache: {
        get: async (key: string): Promise<any> => lruCache!.get(key),
        set: async (key: string, value: any): Promise<void> => {
          lruCache!.set(key, value);
        },
      },
    });

    await payment.prepare({
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
