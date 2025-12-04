import { BankProBaseUrls, BankProInvoiceGatewayOptions, BankProInvoiceIssueOptions } from '../src/typings';
import { BankProInvoiceGateway } from '../src/bank-pro-invoice-gateway';
import { TaxType } from '../../invoice/src/typings';
import * as InvoiceUtils from '../../invoice/src/utils/get-tax-type-from-items';

describe('Bank Pro Invoice Gateway', () => {
  let gateway: BankProInvoiceGateway;

  const mockOptions: BankProInvoiceGatewayOptions = {
    user: 'user1',
    password: 'password1',
    systemOID: 108,
    sellerBAN: '12345675',
    baseUrl: 'http://example.com' as BankProBaseUrls,
  };

  const mockOrderOptions: BankProInvoiceIssueOptions = {
    orderId: 'orderId_123',
    sellerCode: 'sellerCode_123',
    companyName: 'ABC Company',
    remark: 'TEST_REMARK',
    buyerEmail: 'johndoe678@example.com',
    buyerName: 'John Doe',
    buyerZipCode: '12345',
    buyerAddress: '123 Main St, Anytown, USA',
    buyerMobile: '9876543210',
    items: [
      {
        name: 'item 1',
        unitPrice: 1000,
        quantity: 3,
        remark: 'TEST_ITEM_REMARK_1',
        id: 'item_0001',
        spec: 'TEST_ITEM_SPEC_1',
      },
      {
        name: 'item 2',
        unitPrice: 2000,
        quantity: 2,
        remark: 'TEST_ITEM_REMARK_2',
        id: 'item_0002',
        spec: 'TEST_ITEM_SPEC_2',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw error if seller BAN is an invalid VAT Number', () => {
    expect(() => (gateway = new BankProInvoiceGateway({ ...mockOptions, sellerBAN: '12345678' }))).toThrow(
      'Seller BAN should not be a invalid VAT number',
    );
  });

  describe('BankProInvoiceGateway.issue', () => {
    beforeEach(() => {
      gateway = new BankProInvoiceGateway(mockOptions);
    });

    describe('invalid options error', () => {
      it('should throw error if order ID is too long', async () => {
        await expect(
          gateway.issue({ ...mockOrderOptions, orderId: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO' }),
        ).rejects.toThrow('Order ID is too long');
      });

      it('should throw error if VAT number is invalid', async () => {
        await expect(gateway.issue({ ...mockOrderOptions, vatNumber: '12345678' })).rejects.toThrow(
          'VAT number is invalid',
        );
      });

      it('should throw error if remark is too long', async () => {
        await expect(
          gateway.issue({
            ...mockOrderOptions,
            remark:
              'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ab',
          }),
        ).rejects.toThrow('Remark is too long, max: 100');
      });

      it('should trow error if buyerName is too long', async () => {
        await expect(
          gateway.issue({
            ...mockOrderOptions,
            buyerName: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrs',
          }),
        ).rejects.toThrow('Buyer name is too long, max: 80');
      });

      it('should throw error if buyerZipcode is not 1-5 digits', async () => {
        await expect(
          gateway.issue({
            ...mockOrderOptions,
            buyerZipCode: '123456',
          }),
        ).rejects.toThrow('Buyer zip code should be 1-5 digits');
      });

      it('should throw error if buyerAddress is too long', async () => {
        await expect(
          gateway.issue({
            ...mockOrderOptions,
            buyerAddress:
              'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvwxyzABCDEFG',
          }),
        ).rejects.toThrow('Buyer address is too long, max: 240');
      });

      it('should throw error if buyerMobile is too long', async () => {
        await expect(
          gateway.issue({
            ...mockOrderOptions,
            buyerMobile: '123456789012345678901',
          }),
        ).rejects.toThrow('Buyer mobile is too long, max: 20');
      });

      it('should throw error if item name is too long', async () => {
        await expect(
          gateway.issue({
            ...mockOrderOptions,
            items: [
              {
                name: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ababcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789a',
                unitPrice: 1000,
                quantity: 3,
              },
            ],
          }),
        ).rejects.toThrow('Item name is too long, max: 200');
      });

      it('should throw error if item quantity is zero', async () => {
        await expect(
          gateway.issue({
            ...mockOrderOptions,
            items: [
              {
                name: 'item 1',
                unitPrice: 1000,
                quantity: 0,
              },
            ],
          }),
        ).rejects.toThrow('Item quantity should more than zero');
      });

      it('should throw error if item unit is too long', async () => {
        await expect(
          gateway.issue({
            ...mockOrderOptions,
            items: [
              {
                name: 'item 1',
                unitPrice: 1000,
                quantity: 3,
                unit: 'aaaaaaa',
              },
            ],
          }),
        ).rejects.toThrow('Item unit is too long, max: 6');
      });

      it('should throw error if item remark is too long', async () => {
        await expect(
          gateway.issue({
            ...mockOrderOptions,
            items: [
              {
                name: 'item 1',
                unitPrice: 1000,
                quantity: 3,
                remark:
                  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM',
              },
            ],
          }),
        ).rejects.toThrow('Item remark is too long, max: 100');
      });

      it('should throw error if item ID is too long', async () => {
        await expect(
          gateway.issue({
            ...mockOrderOptions,
            items: [
              {
                name: 'item 1',
                unitPrice: 1000,
                quantity: 3,
                id: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO',
              },
            ],
          }),
        ).rejects.toThrow('Item ID is too long, max: 40');
      });

      it('should throw error if item spec is too long', async () => {
        await expect(
          gateway.issue({
            ...mockOrderOptions,
            items: [
              {
                name: 'item 1',
                unitPrice: 1000,
                quantity: 3,
                spec: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM',
              },
            ],
          }),
        ).rejects.toThrow('Item spec is too long, max: 100');
      });

      it('should throw error if buyerEmail is invalid', async () => {
        await expect(
          gateway.issue({
            ...mockOrderOptions,
            buyerEmail: 'test',
          }),
        ).rejects.toThrow('Buyer email is invalid');
      });

      it('should throw error if item taxType is invalid', async () => {
        const spy = jest.spyOn(InvoiceUtils, 'getTaxTypeFromItems').mockReturnValue('INVALID_KEY' as TaxType);

        await expect(
          gateway.issue({
            ...mockOrderOptions,
            items: [
              {
                name: 'item 1',
                unitPrice: 1000,
                quantity: 3,
              },
            ],
          }),
        ).rejects.toThrow('Tax type not supported, you should split tax type in each invoice');

        spy.mockRestore();
      });

      it('should throw error if invoice amount is zero', async () => {
        await expect(
          gateway.issue({
            ...mockOrderOptions,
            items: [
              {
                name: 'item 1',
                unitPrice: 0,
                quantity: 3,
              },
            ],
          }),
        ).rejects.toThrow('Invoice amount should more than zero');
      });
    });
  });
});
