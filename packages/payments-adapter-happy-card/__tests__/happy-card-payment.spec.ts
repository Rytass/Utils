import { HappyCardPayment } from '../src/happy-card-payment';
import { HappyCardOrder } from '../src/happy-card-order';
import { HappyCardProductType, HappyCardRecordType, HappyCardResultCode } from '../src/typings';
import axios from 'axios';

jest.mock('../src/happy-card-order');

describe('HappyCardPayment.prepare', () => {
  let gateway: HappyCardPayment;

  beforeEach(() => {
    gateway = new HappyCardPayment({
      cSource: 'test-source',
      key: 'test-key',
    });

    jest.spyOn(gateway as unknown as { getOrderId: () => string }, 'getOrderId').mockReturnValue('fixed-order-id');

    // Mock getCardBalance
    jest.spyOn(gateway, 'getCardBalance').mockResolvedValue([
      [
        { id: 1, type: HappyCardRecordType.AMOUNT, amount: 100 },
        { id: 2, type: HappyCardRecordType.AMOUNT, amount: 50 },
      ],
      HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
    ]);
  });

  it('should return a HappyCardOrder with correct productType', async () => {
    const options = {
      cardSerial: '1234567890',
      posTradeNo: '1234',
      items: [
        { name: 'Item 1', quantity: 1, unitPrice: 100 },
        { name: 'Item 2', quantity: 1, unitPrice: 50 },
      ],
      useRecords: [
        { id: 1, type: HappyCardRecordType.AMOUNT, amount: 100 },
        { id: 2, type: HappyCardRecordType.AMOUNT, amount: 50 },
      ],
    };

    await gateway.prepare(options);

    expect(gateway.getCardBalance).toHaveBeenCalledWith('1234567890', true);
    expect(HappyCardOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'fixed-order-id',
        productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
        posTradeNo: '1234',
        items: options.items,
      }),
    );
  });
});

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HappyCardPayment.getCardBalance (returnRecords = false)', () => {
  let gateway: HappyCardPayment;

  beforeEach(() => {
    gateway = new HappyCardPayment({
      cSource: 'test-source',
      key: 'test-key',
    });

    // mock getBaseData so we don't test DateTime or hashing
    jest.spyOn(gateway, 'getBaseData').mockReturnValue({
      check: 'MOCKED_CHECKSUM',
      source: 'test-source',
      version: '001',
      store_id: '999999',
      pos_id: '01',
      createdate: '2025-06-09T00:00:00.000Z',
      area: 1,
    });
  });

  it('should return record list and productType when returnRecords is true', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        resultCode: HappyCardResultCode.SUCCESS,
        data: {
          card_list: [
            {
              card_sn: '123456',
              productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
              amt: 100,
              record_list: [
                { record_id: 'r1', type: 1, amt: 60 },
                { record_id: 'r2', type: 1, amt: 40 },
              ],
            },
            {
              card_sn: '789',
              productType: '9',
              amt: 200,
              record_list: [{ record_id: 'r3', type: 1, amt: 100 }],
            },
          ],
        },
      },
    });

    const result = await gateway.getCardBalance('123456', true);

    expect(mockedAxios.post).toHaveBeenCalled();

    expect(result).toEqual([
      [
        { id: 'r1', type: 1, amount: 60 },
        { id: 'r2', type: 1, amount: 40 },
      ],
      HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
    ]);
  });

  it('should return total balance and productType when returnRecords is false', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        resultCode: HappyCardResultCode.SUCCESS,
        data: {
          card_list: [
            {
              card_sn: '123456',
              productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
              amt: 100,
              record_list: [],
            },
            {
              card_sn: '7891011',
              productType: '9',
              amt: 999,
              record_list: [],
            },
            {
              card_sn: '234567',
              productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
              amt: 50,
              record_list: [],
            },
          ],
        },
      },
    });

    const result = await gateway.getCardBalance('123456', false);

    expect(mockedAxios.post).toHaveBeenCalled();
    expect(result).toEqual([150, HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF]);
  });
});
