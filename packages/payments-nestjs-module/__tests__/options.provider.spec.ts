import { Test, TestingModule } from '@nestjs/testing';
import { OptionsProviders } from '../src/typings/options.provider';
import { PAYMENTS_MODULE_OPTIONS, PAYMENTS_GATEWAY } from '../src/typings/symbol';
import { PaymentGateway } from '@rytass/payments';

describe('OptionsProviders', () => {
  it('should export an array of providers', () => {
    expect(Array.isArray(OptionsProviders)).toBe(true);
    expect(OptionsProviders.length).toBe(1);
  });

  it('should provide PAYMENTS_GATEWAY from PAYMENTS_MODULE_OPTIONS', async () => {
    const mockGateway: PaymentGateway = {
      prepare: jest.fn(),
      query: jest.fn(),
    } as unknown as PaymentGateway;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PAYMENTS_MODULE_OPTIONS,
          useValue: {
            paymentGateway: mockGateway,
          },
        },
        ...OptionsProviders,
      ],
    }).compile();

    const gateway = module.get(PAYMENTS_GATEWAY);

    expect(gateway).toBe(mockGateway);
  });

  it('should correctly inject PAYMENTS_MODULE_OPTIONS', () => {
    const provider = OptionsProviders[0];

    expect(provider.provide).toBe(PAYMENTS_GATEWAY);
    expect(provider.inject).toContain(PAYMENTS_MODULE_OPTIONS);
    expect(typeof provider.useFactory).toBe('function');
  });

  it('should extract paymentGateway from options in useFactory', () => {
    const provider = OptionsProviders[0];
    const mockGateway: PaymentGateway = {
      prepare: jest.fn(),
      query: jest.fn(),
    } as unknown as PaymentGateway;

    const result = provider.useFactory({ paymentGateway: mockGateway });

    expect(result).toBe(mockGateway);
  });
});
