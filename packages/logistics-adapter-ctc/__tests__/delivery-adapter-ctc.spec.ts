import axios from 'axios';
import { ErrorCode, LogisticsError } from '@rytass/logistics';
import { CtcLogisticsService, CtcLogistics, CreateOrUpdateCtcLogisticsOptions } from '../src';

// Mock axios module
jest.mock('axios', () => {
  const actualAxios = jest.requireActual('axios');

  return {
    ...actualAxios,
    get: jest.fn(),
    post: jest.fn(),
    isAxiosError: actualAxios.isAxiosError,
  };
});

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('delivery-adapter-ctc', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('trace logistics', () => {
    it('should trace single logistic with default configuration', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);

      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          shipment_history: [{ status: '新單', code: 10, created_at: '2025-06-11 17:26:10' }],
          images: [],
        },
      });

      const result = await logisticsService.trace(['R25061100009']);

      expect(result).toHaveLength(1);
      expect(result[0].logisticsId).toBe('R25061100009');
      expect(result[0].statusHistory).toHaveLength(1);
      expect(result[0].statusHistory[0].status).toBe('CREATED');
    });

    it('should trace single logistic string (not array)', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);

      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          shipment_history: [{ status: '已取件', code: 30, created_at: '2025-06-11 17:26:10' }],
          images: [],
        },
      });

      const result = await logisticsService.trace('R25061100009');

      expect(result).toHaveLength(1);
      expect(result[0].statusHistory[0].status).toBe('PICKED_UP');
    });

    it('should throw error when status !== 200 and ignoreNotFound is false', async () => {
      const logisticsService = new CtcLogisticsService({
        url: 'https://tms2.ctc-express.cloud/api/v1/customer/orders',
        apiToken: 'test-token',
        ignoreNotFound: false,
      });

      mockedAxios.get.mockResolvedValueOnce({
        status: 404,
        data: { success: false },
      });

      try {
        const result = await logisticsService.trace(['R25061100009']);

        // If we get here, the test should fail
        throw new Error(`Expected to throw but got result: ${JSON.stringify(result)}`);
      } catch (err) {
        expect(err).toBeInstanceOf(LogisticsError);
      }
    });

    it('should return empty statusHistory when status !== 200 and ignoreNotFound is true', async () => {
      const logisticsService = new CtcLogisticsService({
        url: 'https://tms2.ctc-express.cloud/api/v1/customer/orders',
        apiToken: 'test-token',
        ignoreNotFound: true,
      });

      mockedAxios.get.mockResolvedValueOnce({
        status: 404,
        data: { success: false },
      });

      const result = await logisticsService.trace(['R25061100009']);

      expect(result).toHaveLength(1);
      expect(result[0].statusHistory).toHaveLength(0);
    });

    it('should throw error when data.success is false and ignoreNotFound is false', async () => {
      const logisticsService = new CtcLogisticsService({
        url: 'https://tms2.ctc-express.cloud/api/v1/customer/orders',
        apiToken: 'test-token',
        ignoreNotFound: false,
      });

      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { success: false, shipment_history: [], images: [] },
      });

      try {
        const result = await logisticsService.trace(['R25061100009']);

        throw new Error(`Expected to throw but got result: ${JSON.stringify(result)}`);
      } catch (err) {
        expect(err).toBeInstanceOf(LogisticsError);
      }
    });

    it('should return empty statusHistory when data.success is false and ignoreNotFound is true', async () => {
      const logisticsService = new CtcLogisticsService({
        url: 'https://tms2.ctc-express.cloud/api/v1/customer/orders',
        apiToken: 'test-token',
        ignoreNotFound: true,
      });

      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { success: false, shipment_history: [], images: [] },
      });

      const result = await logisticsService.trace(['R25061100009']);

      expect(result).toHaveLength(1);
      expect(result[0].statusHistory).toHaveLength(0);
    });

    it('should rethrow LogisticsError in catch block', async () => {
      const logisticsService = new CtcLogisticsService({
        url: 'https://tms2.ctc-express.cloud/api/v1/customer/orders',
        apiToken: 'test-token',
        ignoreNotFound: false,
      });

      const logisticsError = new LogisticsError(ErrorCode.INVALID_PARAMETER, 'Test error');

      mockedAxios.get.mockRejectedValueOnce(logisticsError);

      try {
        await logisticsService.trace(['R25061100009']);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).toBe(logisticsError);
      }
    });

    it('should throw permission denied error on 403 axios error', async () => {
      const logisticsService = new CtcLogisticsService({
        url: 'https://tms2.ctc-express.cloud/api/v1/customer/orders',
        apiToken: 'test-token',
        ignoreNotFound: false,
      });

      // Create an axios-like error object that axios.isAxiosError will recognize
      const axiosError = new Error('Forbidden') as Error & {
        isAxiosError: boolean;
        response: { status: number; data: unknown };
      };

      axiosError.isAxiosError = true;
      axiosError.response = { status: 403, data: {} };

      mockedAxios.get.mockRejectedValueOnce(axiosError);

      try {
        await logisticsService.trace(['R25061100009']);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(LogisticsError);
        expect((err as LogisticsError).code).toBe(ErrorCode.PERMISSION_DENIED);
      }
    });

    it('should throw error on axios error with ignoreNotFound false', async () => {
      const logisticsService = new CtcLogisticsService({
        url: 'https://tms2.ctc-express.cloud/api/v1/customer/orders',
        apiToken: 'test-token',
        ignoreNotFound: false,
      });

      const axiosError = new Error('Server Error') as Error & {
        isAxiosError: boolean;
        response: { status: number; data: unknown };
      };

      axiosError.isAxiosError = true;
      axiosError.response = { status: 500, data: { error: 'Internal' } };

      mockedAxios.get.mockRejectedValueOnce(axiosError);

      try {
        await logisticsService.trace(['R25061100009']);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(LogisticsError);
      }
    });

    it('should return empty statusHistory on axios error with ignoreNotFound true', async () => {
      const logisticsService = new CtcLogisticsService({
        url: 'https://tms2.ctc-express.cloud/api/v1/customer/orders',
        apiToken: 'test-token',
        ignoreNotFound: true,
      });

      const axiosError = new Error('Server Error') as Error & {
        isAxiosError: boolean;
        response: { status: number; data: unknown };
      };

      axiosError.isAxiosError = true;
      axiosError.response = { status: 500, data: { error: 'Internal' } };

      mockedAxios.get.mockRejectedValueOnce(axiosError);

      const result = await logisticsService.trace(['R25061100009']);

      expect(result).toHaveLength(1);
      expect(result[0].statusHistory).toHaveLength(0);
    });

    it('should rethrow unknown errors in catch block', async () => {
      const logisticsService = new CtcLogisticsService({
        url: 'https://tms2.ctc-express.cloud/api/v1/customer/orders',
        apiToken: 'test-token',
        ignoreNotFound: false,
      });

      const unknownError = new Error('Unknown error');

      mockedAxios.get.mockRejectedValueOnce(unknownError);

      await expect(logisticsService.trace(['R25061100009'])).rejects.toThrow(unknownError);
    });
  });

  describe('create logistics', () => {
    const baseOptions: CreateOrUpdateCtcLogisticsOptions = {
      senderCompany: 'Sender Name',
      senderMobile: '1234567890',
      senderAddress: 'Sender Address',
      receiverCompany: 'Receiver Name',
      receiverContactName: 'Receiver Contact',
      receiverMobile: '0987654321',
      receiverAddress: 'Receiver Address',
      paidCode: '客戶宅配',
    };

    it('should create logistics successfully', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          error: '',
          shipping_number: 'R25071700027',
          tracking_number: 'ABCD202507170001',
        },
      });

      const result = await logisticsService.create({
        ...baseOptions,
        trackingNumber: 'ABCD202507170001',
      });

      expect(result.shippingNumber).toBe('R25071700027');
      expect(result.trackingNumber).toBe('ABCD202507170001');
    });

    it('should create logistics with senderTel and receiverTel instead of mobile', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          error: '',
          shipping_number: 'R25071700028',
          tracking_number: 'ABCD202507170002',
        },
      });

      const options: CreateOrUpdateCtcLogisticsOptions = {
        senderCompany: 'Sender Name',
        senderTel: '0212345678', // Use tel instead of mobile
        senderAddress: 'Sender Address',
        receiverCompany: 'Receiver Name',
        receiverContactName: 'Receiver Contact',
        receiverTel: '0287654321', // Use tel instead of mobile
        receiverAddress: 'Receiver Address',
        paidCode: '客戶宅配',
        trackingNumber: 'ABCD202507170002',
      };

      const result = await logisticsService.create(options);

      expect(result.shippingNumber).toBe('R25071700028');
      expect(result.trackingNumber).toBe('ABCD202507170002');

      // Verify the request body was constructed correctly
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          order: expect.objectContaining({
            sender_tel: '0212345678',
            sender_mobile: '',
            receiver_tel: '0287654321',
            receiver_mobile: '',
          }),
        }),
        expect.any(Object),
      );
    });

    it('should throw error when senderTel and senderMobile are missing', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);

      const options: CreateOrUpdateCtcLogisticsOptions = {
        senderCompany: 'Sender Name',
        senderAddress: 'Sender Address',
        receiverCompany: 'Receiver Name',
        receiverContactName: 'Receiver Contact',
        receiverMobile: '0987654321',
        receiverAddress: 'Receiver Address',
        paidCode: '客戶宅配',
      };

      try {
        await logisticsService.create(options);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(LogisticsError);
        expect((err as LogisticsError).message).toBe('Either senderTel or senderMobile must be provided.');
      }
    });

    it('should throw error when receiverTel and receiverMobile are missing', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);

      const options: CreateOrUpdateCtcLogisticsOptions = {
        senderCompany: 'Sender Name',
        senderMobile: '1234567890',
        senderAddress: 'Sender Address',
        receiverCompany: 'Receiver Name',
        receiverContactName: 'Receiver Contact',
        receiverAddress: 'Receiver Address',
        paidCode: '客戶宅配',
      };

      try {
        await logisticsService.create(options);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(LogisticsError);
        expect((err as LogisticsError).message).toBe('Either receiverTel or receiverMobile must be provided.');
      }
    });

    it('should throw error when create fails with trackingNumber', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: false,
          error: 'Duplicate tracking number',
          shipping_number: '',
        },
      });

      try {
        await logisticsService.create({
          ...baseOptions,
          trackingNumber: 'EXISTING',
        });

        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(LogisticsError);
        expect((err as LogisticsError).code).toBe(ErrorCode.INVALID_PARAMETER);
      }
    });

    it('should throw error when create fails without trackingNumber', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: false,
          error: 'Validation failed',
          shipping_number: '',
        },
      });

      try {
        await logisticsService.create(baseOptions);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(LogisticsError);
        expect((err as LogisticsError).code).toBe(ErrorCode.INVALID_PARAMETER);
      }
    });

    it('should rethrow LogisticsError in create catch block', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);
      const logisticsError = new LogisticsError(ErrorCode.INVALID_PARAMETER, 'Test error');

      mockedAxios.post.mockRejectedValueOnce(logisticsError);

      try {
        await logisticsService.create(baseOptions);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).toBe(logisticsError);
      }
    });

    it('should throw LogisticsError on axios error with trackingNumber', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);

      const axiosError = new Error('Server Error') as Error & {
        isAxiosError: boolean;
        response: { status: number; data: { error: string } };
      };

      axiosError.isAxiosError = true;
      axiosError.response = { status: 500, data: { error: 'Internal' } };

      mockedAxios.post.mockRejectedValueOnce(axiosError);

      try {
        await logisticsService.create({
          ...baseOptions,
          trackingNumber: 'TRACK123',
        });

        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(LogisticsError);
        expect((err as LogisticsError).code).toBe(ErrorCode.INVALID_PARAMETER);
      }
    });

    it('should throw LogisticsError on axios error without trackingNumber', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);

      const axiosError = new Error('Server Error') as Error & {
        isAxiosError: boolean;
        response: { status: number; data: { error: string } };
      };

      axiosError.isAxiosError = true;
      axiosError.response = { status: 500, data: { error: 'Internal' } };

      mockedAxios.post.mockRejectedValueOnce(axiosError);

      try {
        await logisticsService.create(baseOptions);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(LogisticsError);
        expect((err as LogisticsError).code).toBe(ErrorCode.INVALID_PARAMETER);
      }
    });

    it('should rethrow unknown errors in create catch block', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);
      const unknownError = new Error('Unknown error');

      mockedAxios.post.mockRejectedValueOnce(unknownError);

      await expect(logisticsService.create(baseOptions)).rejects.toThrow(unknownError);
    });
  });

  describe('update logistics', () => {
    const baseOptions: CreateOrUpdateCtcLogisticsOptions = {
      trackingNumber: 'TRACK123',
      senderCompany: 'Sender Name',
      senderMobile: '1234567890',
      senderAddress: 'Sender Address',
      receiverCompany: 'Receiver Name',
      receiverContactName: 'Receiver Contact',
      receiverMobile: '0987654321',
      receiverAddress: 'Receiver Address',
      paidCode: '客戶宅配',
    };

    it('should update logistics successfully', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);

      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          shipment_history: [{ status: '新單', code: 10, created_at: '2025-06-11 17:26:10' }],
          images: [],
        },
      });

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          error: '',
          shipping_number: 'R25071700027',
          tracking_number: 'TRACK123',
        },
      });

      const result = await logisticsService.update(baseOptions);

      expect(result.shippingNumber).toBe('R25071700027');
    });

    it('should throw error when trackingNumber is missing', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);

      const options: CreateOrUpdateCtcLogisticsOptions = {
        senderCompany: 'Sender Name',
        senderMobile: '1234567890',
        senderAddress: 'Sender Address',
        receiverCompany: 'Receiver Name',
        receiverContactName: 'Receiver Contact',
        receiverMobile: '0987654321',
        receiverAddress: 'Receiver Address',
        paidCode: '客戶宅配',
      };

      try {
        await logisticsService.update(options);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(LogisticsError);
        expect((err as LogisticsError).message).toBe('trackingNumber is required for update.');
      }
    });

    it('should throw NOT_FOUND_ERROR when statusHistory is empty', async () => {
      const logisticsService = new CtcLogisticsService({
        url: 'https://tms2.ctc-express.cloud/api/v1/customer/orders',
        apiToken: 'test-token',
        ignoreNotFound: true,
      });

      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { success: false, shipment_history: [], images: [] },
      });

      try {
        await logisticsService.update(baseOptions);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(LogisticsError);
        expect((err as LogisticsError).code).toBe(ErrorCode.NOT_FOUND_ERROR);
      }
    });

    it('should rethrow LogisticsError in update catch block', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);
      const logisticsError = new LogisticsError(ErrorCode.INVALID_PARAMETER, 'Test error');

      mockedAxios.get.mockRejectedValueOnce(logisticsError);

      try {
        await logisticsService.update(baseOptions);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).toBe(logisticsError);
      }
    });

    it('should rethrow unknown errors in update catch block', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);
      const unknownError = new Error('Unknown error');

      mockedAxios.get.mockRejectedValueOnce(unknownError);

      await expect(logisticsService.update(baseOptions)).rejects.toThrow(unknownError);
    });

    it('should throw LogisticsError on axios error from getLogisticsStatuses during update', async () => {
      const logisticsService = new CtcLogisticsService({
        url: 'https://tms2.ctc-express.cloud/api/v1/customer/orders',
        apiToken: 'test-token',
        ignoreNotFound: false,
      });

      const axiosError = new Error('Server Error') as Error & {
        isAxiosError: boolean;
        response: { status: number; data: unknown };
      };

      axiosError.isAxiosError = true;
      axiosError.response = { status: 500, data: { error: 'Internal' } };

      mockedAxios.get.mockRejectedValueOnce(axiosError);

      try {
        await logisticsService.update(baseOptions);
        throw new Error('Expected to throw');
      } catch (err) {
        // The axios error from getLogisticsStatuses is converted to LogisticsError
        // which is then rethrown by update's catch block
        expect(err).toBeInstanceOf(LogisticsError);
        expect((err as LogisticsError).code).toBe(ErrorCode.INVALID_PARAMETER);
      }
    });

    it('should throw LogisticsError on axios error from create during update', async () => {
      const logisticsService = new CtcLogisticsService(CtcLogistics);

      // First mock get to succeed - getLogisticsStatuses returns success
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          shipment_history: [{ status: '新單', code: 10, created_at: '2025-06-11 17:26:10' }],
          images: [],
        },
      });

      // Then mock post (create) to throw axios error
      const axiosError = new Error('Server Error') as Error & {
        isAxiosError: boolean;
        response: { status: number; data: { error: string } };
      };

      axiosError.isAxiosError = true;
      axiosError.response = { status: 500, data: { error: 'Internal' } };

      mockedAxios.post.mockRejectedValueOnce(axiosError);

      try {
        await logisticsService.update(baseOptions);
        throw new Error('Expected to throw');
      } catch (err) {
        // The axios error from create is caught by create's own catch block
        // and converted to LogisticsError, which is then rethrown by update's catch block
        expect(err).toBeInstanceOf(LogisticsError);
        expect((err as LogisticsError).code).toBe(ErrorCode.INVALID_PARAMETER);
      }
    });
  });
});
