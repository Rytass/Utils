import { LogisticsError } from '@rytass/logistics';
import { CtcLogisticsService, CtcLogistics, CreateOrUpdateCtcLogisticsOptions } from '../src';
import axios from 'axios';

describe('delivery-adapter-ctc', () => {
  const get = jest.spyOn(axios, 'get');

  describe('get logistics tracing', () => {
    it('should trace single logistic with default configuration', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);

      const logisticId = ['R25061100009'];

      get.mockImplementationOnce(async (url: string) => {
        expect(url).toBe('https://tms2.ctc-express.cloud/api/v1/customer/orders/R25061100009');

        return {
          status: 200,
          data: {
            success: true,
            shipment_history: [
              {
                status: '新單測試',
                code: 10,
                created_at: '2025-06-11 17:26:10',
              },
            ],
            images: [],
          },
        };
      });

      try {
        await logisticsService.trace(logisticId);
      } catch (error) {
        console.error(`Error occurred: ${error instanceof LogisticsError ? error.message : error}`);
      }
    });

    it('should trace single logistic with specific configuration', async () => {
      const logisticsService = new CtcLogisticsService({
        url: 'https://tms2.ctc-express.cloud/api/v1/customer/orders',
        apiToken: 'c5a41fd4ab87598f47eda26c7c54f512',
        ignoreNotFound: true,
      });

      const logisticId = ['R25061100009'];

      get.mockImplementationOnce(async (url: string) => {
        expect(url).toBe('https://tms2.ctc-express.cloud/api/v1/customer/orders/R25061100009');

        return {
          status: 200,
          data: {
            success: true,
            shipment_history: [
              {
                status: '新單測試',
                code: 10,
                created_at: '2025-06-11 17:26:10',
              },
            ],
            images: [],
          },
        };
      });

      try {
        await logisticsService.trace(logisticId);
      } catch (error) {
        console.error(`Error occurred: ${error instanceof LogisticsError ? error.message : error}`);
      }
    });
  });

  describe('create or update logistics with default configuration', () => {
    const logisticsService = new CtcLogisticsService(CtcLogistics);
    const post = jest.spyOn(axios, 'post');

    const createOrUpdateCtcLogisticsOptions = {
      shippingNumber: 'R25071700027', // 托運單號
      trackingNumber: 'ABCD202507170001', // 查件單號
      senderCompany: 'Sender Name',
      senderMobile: '1234567890',
      senderAddress: 'Sender Address',
      receiverCompany: 'Receiver Name',
      receiverContactName: 'Receiver Contact',
      receiverMobile: '0987654321',
      receiverAddress: 'Receiver Address',

      payCode: '客戶宅配',
      customerDepartmentId: 1572, // 客戶部門ID, optional
      senderContactName: 'Sender Contact', // 寄件人聯絡人, optional
      senderTel: '12345678', // 寄件人市話, optional
      senderRemark: 'Sender Remark', // 寄件人備註, optional
      receiverTel: '87654321', // 收件人市話, optional
      receiverRemark: 'Receiver Remark', // 收件人備註, optional
      shipmentContent: '貨件', // 貨物內容, 固定為 '貨件'
      transportation: 'truck', // 運輸工具, 固定為 'truck'
      shippingMethod: 'land', // 運送方式, 固定為 'land'
      payer: 'sender', // 費用支付方, 固定為 'sender'
      shippingTime: 'regular', // 送件時效, 固定為 'regular'
      paymentMethod: 'monthly', // 結算方式, 固定為 'monthly'
      quantity: 1, // 件數, 固定為 1
      weight: 1, // 重量, 固定為 1
      volume: 1, // 材積, 固定為 1
    } as CreateOrUpdateCtcLogisticsOptions;

    post.mockImplementation(async (url: string) => {
      expect(url).toBe('https://tms2.ctc-express.cloud/api/v1/customer/orders');

      return {
        data: {
          success: true,
          error: '', // 添加空的 error 字段表示沒有錯誤
          shipping_number: 'R25071700027',
          tracking_number: 'ABCD202507170001',
        },
      };
    });

    it('should create a new logistics with default configuration', async () => {
      await logisticsService.create(createOrUpdateCtcLogisticsOptions);
    });

    it('should update a logistics with default configuration', async () => {
      // Mock the get request for update operation
      get.mockImplementationOnce(async (url: string) => {
        expect(url).toBe('https://tms2.ctc-express.cloud/api/v1/customer/orders/ABCD202507170001');

        return {
          status: 200,
          data: {
            success: true,
            shipment_history: [
              {
                status: '新單測試',
                code: 10,
                created_at: '2025-06-11 17:26:10',
              },
            ],
            images: [],
          },
        };
      });

      createOrUpdateCtcLogisticsOptions.receiverCompany = 'Updated Receiver Name';

      await logisticsService.update(createOrUpdateCtcLogisticsOptions);
    });
  });
});
