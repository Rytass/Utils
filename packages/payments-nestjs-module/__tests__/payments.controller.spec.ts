import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from '../src/payments.controller';
import { PAYMENTS_GATEWAY } from '../src/typings/symbol';
import { NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { PaymentGateway, RawBodyRequest } from '@rytass/payments';
import { WithServerGateway } from '../src/typings/with-server-gateway.dto';

jest.mock('@rytass/member-base-nestjs-module', () => ({
  IsPublic: () => (): void => {},
}));

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let mockGateway: PaymentGateway & WithServerGateway;
  let mockRequest: RawBodyRequest<Request>;
  let mockResponse: Response;

  beforeEach(async () => {
    mockGateway = {
      prepare: jest.fn(),
      query: jest.fn(),
      defaultServerListener: jest.fn(),
    } as unknown as PaymentGateway & WithServerGateway;

    mockRequest = {} as RawBodyRequest<Request>;
    mockResponse = {} as Response;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PAYMENTS_GATEWAY,
          useValue: mockGateway,
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  describe('checkout', () => {
    it('should call defaultServerListener when available', () => {
      controller.checkout('test-order-123', mockRequest, mockResponse);

      expect(mockGateway.defaultServerListener).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should throw NotFoundException when defaultServerListener is not available', () => {
      mockGateway.defaultServerListener = undefined;

      expect(() => {
        controller.checkout('test-order-123', mockRequest, mockResponse);
      }).toThrow(NotFoundException);
    });

    it('should throw NotFoundException with correct message', () => {
      mockGateway.defaultServerListener = undefined;

      expect(() => {
        controller.checkout('test-order-123', mockRequest, mockResponse);
      }).toThrow('Page Not Found');
    });
  });

  describe('callbacks', () => {
    it('should call defaultServerListener when available', () => {
      controller.callbacks(mockRequest, mockResponse);

      expect(mockGateway.defaultServerListener).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should throw NotFoundException when defaultServerListener is not available', () => {
      mockGateway.defaultServerListener = undefined;

      expect(() => {
        controller.callbacks(mockRequest, mockResponse);
      }).toThrow(NotFoundException);
    });

    it('should throw NotFoundException with correct message', () => {
      mockGateway.defaultServerListener = undefined;

      expect(() => {
        controller.callbacks(mockRequest, mockResponse);
      }).toThrow('Page Not Found');
    });
  });
});
