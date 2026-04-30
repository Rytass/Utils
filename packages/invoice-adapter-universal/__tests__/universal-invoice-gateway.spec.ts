import axios from 'axios';
import { InvoiceCarriers, InvoiceState, TaxType } from '../../invoice/src';
import { UniversalBaseUrls } from '../src/constants';
import { UniversalInvoiceGateway } from '../src/universal-invoice-gateway';
import { UniversalRequestBody } from '../src/typings';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('UniversalInvoiceGateway', () => {
  const gateway = new UniversalInvoiceGateway({
    companyID: '12345675',
    userID: 'user',
    auth: 'password',
    apiKey: 'api-key',
    sellerID: '12345675',
    baseUrl: 'https://example.com',
    unitCode: 'POS01',
    skipMobileBarcodeValidation: true,
    skipLoveCodeValidation: true,
  });

  beforeEach(() => {
    mockedAxios.post.mockReset();
  });

  const mockIssueSuccess = (): void => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        statusCode: '0',
        respData: {
          invNo: 'AB12345678',
          invDate: '20260430',
          invTime: '12:30:45',
          randomNumber: '1234',
        },
      },
    });
  };

  it('should issue B2C invoice with mobile carrier', async () => {
    mockIssueSuccess();

    const invoice = await gateway.issue({
      orderId: 'ORD001',
      buyerName: 'A123',
      buyerEmail: 'buyer@example.com',
      carrier: InvoiceCarriers.MOBILE('/ABC1234'),
      items: [
        {
          name: 'item 1',
          quantity: 1,
          unitPrice: 105,
          taxType: TaxType.TAXED,
        },
      ],
    });

    const request = mockedAxios.post.mock.calls[0][1] as UniversalRequestBody<Record<string, unknown>>;

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://example.com/openInvoice',
      expect.objectContaining({
        companyID: '12345675',
        userID: 'user',
        auth: Buffer.from('password').toString('base64'),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    expect(request.reqData).toMatchObject({
      orderID: 'ORD001',
      process_type: 'C',
      buyerID: '0000000000',
      buyerName: 'A123',
      carrierType: '3J0002',
      carrierID1: '/ABC1234',
      carrierID2: '/ABC1234',
      printMark: 'N',
      salesAmount: 100,
      taxAmount: 5,
      totalAmount: 105,
      unitCode: 'POS01',
    });

    expect(invoice.invoiceNumber).toBe('AB12345678');
    expect(invoice.randomCode).toBe('1234');
  });

  it('should issue B2B invoice with untaxed detail price', async () => {
    mockIssueSuccess();

    await gateway.issue({
      orderId: 'ORD002',
      vatNumber: '24536806',
      buyerName: '買方公司',
      carrier: InvoiceCarriers.PRINT,
      items: [
        {
          name: 'item 1',
          quantity: 1,
          unitPrice: 105,
          taxType: TaxType.TAXED,
        },
      ],
    });

    const request = mockedAxios.post.mock.calls[0][1] as UniversalRequestBody<{
      Details: { unitprice: number; amount: number }[];
    }>;

    expect(request.reqData.process_type).toBe('B');
    expect(request.reqData.buyerID).toBe('24536806');
    expect(request.reqData.printMark).toBe('Y');
    expect(request.reqData.Details[0].unitprice).toBe(100);
    expect(request.reqData.Details[0].amount).toBe(100);
  });

  it('should issue mixed tax invoice with detail tax types', async () => {
    mockIssueSuccess();

    await gateway.issue({
      orderId: 'ORD_MIXED',
      buyerName: 'A123',
      items: [
        {
          name: 'taxed item',
          quantity: 1,
          unitPrice: 105,
          taxType: TaxType.TAXED,
        },
        {
          name: 'free item',
          quantity: 1,
          unitPrice: 50,
          taxType: TaxType.TAX_FREE,
        },
      ],
    });

    const request = mockedAxios.post.mock.calls[0][1] as UniversalRequestBody<{
      taxType: string;
      freetaxSalesamount: number;
      Details: { taxType?: string }[];
    }>;

    expect(request.reqData.taxType).toBe('9');
    expect(request.reqData.freetaxSalesamount).toBe(50);
    expect(request.reqData.Details.map(item => item.taxType)).toEqual(['1', '3']);
  });

  it('should issue zero tax invoice with zero tax reason and customs mark', async () => {
    mockIssueSuccess();

    await gateway.issue({
      orderId: 'ORD_ZERO',
      buyerName: 'A123',
      zeroTaxRateReason: '71',
      customsMark: 'YES',
      items: [
        {
          name: 'zero item',
          quantity: 1,
          unitPrice: 100,
          taxType: TaxType.ZERO_TAX,
        },
      ],
    });

    const request = mockedAxios.post.mock.calls[0][1] as UniversalRequestBody<Record<string, unknown>>;

    expect(request.reqData).toMatchObject({
      taxrate: 0,
      zerotaxSalesamount: 100,
      customsClearanceMark: '2',
      zeroTaxRateReason: '71',
    });
  });

  it('should issue zero tax invoice with non-customs clearance mark', async () => {
    mockIssueSuccess();

    await gateway.issue({
      orderId: 'ORD_ZERO_NO_CUSTOMS',
      buyerName: 'A123',
      zeroTaxRateReason: '71',
      items: [
        {
          name: 'zero item',
          quantity: 1,
          unitPrice: 100,
          taxType: TaxType.ZERO_TAX,
        },
      ],
    });

    const request = mockedAxios.post.mock.calls[0][1] as UniversalRequestBody<Record<string, unknown>>;

    expect(request.reqData.customsClearanceMark).toBe('1');
  });

  it('should issue special tax and mixed tax invoices with default item tax type', async () => {
    mockIssueSuccess();

    await gateway.issue({
      orderId: 'ORD_SPECIAL',
      buyerName: 'A123',
      items: [
        {
          name: 'special item',
          quantity: 1,
          unitPrice: 105,
          taxType: TaxType.SPECIAL,
        },
      ],
    });

    mockIssueSuccess();

    await gateway.issue({
      orderId: 'ORD_MIXED_DEFAULT',
      buyerName: 'A123',
      items: [
        {
          name: 'default taxed item',
          quantity: 1,
          unitPrice: 105,
        },
        {
          name: 'free item',
          quantity: 1,
          unitPrice: 50,
          taxType: TaxType.TAX_FREE,
        },
      ],
    });

    const specialRequest = mockedAxios.post.mock.calls[0][1] as UniversalRequestBody<Record<string, unknown>>;
    const mixedRequest = mockedAxios.post.mock.calls[1][1] as UniversalRequestBody<{
      taxType: string;
      Details: { taxType?: string }[];
    }>;

    expect(specialRequest.reqData.taxType).toBe('4');
    expect(mixedRequest.reqData.taxType).toBe('9');
    expect(mixedRequest.reqData.Details.map(item => item.taxType)).toEqual(['1', '3']);
  });

  it('should use default base url when baseUrl is omitted', async () => {
    const defaultGateway = new UniversalInvoiceGateway({
      companyID: '12345675',
      userID: 'user',
      auth: 'password',
      apiKey: 'api-key',
      sellerID: '12345675',
      skipMobileBarcodeValidation: true,
      skipLoveCodeValidation: true,
    });

    mockIssueSuccess();

    await defaultGateway.issue({
      orderId: 'ORD_DEFAULT_BASE_URL',
      buyerName: 'A123',
      items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
    });

    expect(mockedAxios.post.mock.calls[0][0]).toBe(`${UniversalBaseUrls.DEVELOPMENT}/openInvoice`);
  });

  it('should map MOICA, member, love code, and print carriers', async () => {
    mockIssueSuccess();
    await gateway.issue({
      orderId: 'ORD_MOICA',
      buyerName: 'A123',
      carrier: InvoiceCarriers.MOICA('AB12345678901234'),
      items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
    });

    mockIssueSuccess();
    await gateway.issue({
      orderId: 'ORD_MEMBER',
      buyerName: 'A123',
      carrier: { type: 'MEMBER', code: 'MEM001' },
      items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
    });

    mockIssueSuccess();
    await gateway.issue({
      orderId: 'ORD_LOVE',
      buyerName: 'A123',
      carrier: InvoiceCarriers.LOVE_CODE('001'),
      items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
    });

    mockIssueSuccess();
    await gateway.issue({
      orderId: 'ORD_PRINT',
      buyerName: 'A123',
      carrier: InvoiceCarriers.PRINT,
      items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
    });

    const requests = mockedAxios.post.mock.calls.map(call => call[1] as UniversalRequestBody<Record<string, unknown>>);

    expect(requests[0].reqData).toMatchObject({ carrierType: 'CQ0001', carrierID1: 'AB12345678901234' });
    expect(requests[1].reqData).toMatchObject({ carrierType: 'EG0478', carrierID1: 'MEM001' });
    expect(requests[2].reqData).toMatchObject({ donateMark: '1', npoban: '001', printMark: 'N' });
    expect(requests[3].reqData).toMatchObject({ donateMark: '0', printMark: 'Y' });
  });

  it('should resolve buyer name from resolver', async () => {
    const resolverGateway = new UniversalInvoiceGateway({
      companyID: '12345675',
      userID: 'user',
      auth: 'password',
      apiKey: 'api-key',
      sellerID: '12345675',
      baseUrl: 'https://example.com',
      buyerNameResolver: (): string => 'R001',
    });

    mockIssueSuccess();

    await resolverGateway.issue({
      orderId: 'ORD_RESOLVER',
      items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
    });

    const request = mockedAxios.post.mock.calls[0][1] as UniversalRequestBody<Record<string, unknown>>;

    expect(request.reqData.buyerName).toBe('R001');
  });

  it('should reject zero tax invoice without zero tax reason', async () => {
    await expect(
      gateway.issue({
        orderId: 'ORD003',
        buyerName: 'A123',
        items: [
          {
            name: 'item 1',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.ZERO_TAX,
          },
        ],
      }),
    ).rejects.toThrow('Zero tax rate reason is required');
  });

  it('should reject invalid local input before API call', async () => {
    await expect(gateway.issue({ orderId: '', buyerName: 'A123', items: [] })).rejects.toThrow('Order ID is required');

    await expect(
      gateway.issue({
        orderId: 'ORD_BAD_VAT',
        vatNumber: '12345678',
        buyerName: 'A123',
        items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
      }),
    ).rejects.toThrow('VAT number is invalid');

    await expect(
      gateway.issue({
        orderId: 'ORD_BAD_BUYER',
        buyerName: '0000',
        items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
      }),
    ).rejects.toThrow('Buyer name is required');

    await expect(
      gateway.issue({
        orderId: 'ORD_LONG_BUYER',
        buyerName: 'x'.repeat(61),
        items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
      }),
    ).rejects.toThrow('Buyer name is too long');

    await expect(
      gateway.issue({
        orderId: 'ORD_LONG_ADDRESS',
        buyerName: 'A123',
        buyerAddress: 'x'.repeat(101),
        items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
      }),
    ).rejects.toThrow('Buyer address is too long');

    await expect(
      gateway.issue({
        orderId: 'ORD_LONG_REMARK',
        buyerName: 'A123',
        remark: 'x'.repeat(201),
        items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
      }),
    ).rejects.toThrow('Remark is too long');

    await expect(
      gateway.issue({
        orderId: 'ORD_BAD_EMAIL',
        buyerName: 'A123',
        buyerEmail: 'not-email',
        items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
      }),
    ).rejects.toThrow('Buyer email is invalid');

    await expect(
      gateway.issue({
        orderId: 'ORD_BAD_AMOUNT',
        buyerName: 'A123',
        items: [{ name: 'item', quantity: 0, unitPrice: 105 }],
      }),
    ).rejects.toThrow('Invoice amount should more than zero');

    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('should reject invalid item fields before API call', async () => {
    await expect(
      gateway.issue({
        orderId: 'ORD_LONG_ITEM',
        buyerName: 'A123',
        items: [{ name: 'x'.repeat(501), quantity: 1, unitPrice: 105 }],
      }),
    ).rejects.toThrow('Item name is too long');

    await expect(
      gateway.issue({
        orderId: 'ORD_LONG_UNIT',
        buyerName: 'A123',
        items: [{ name: 'item', quantity: 1, unitPrice: 105, unit: 'x'.repeat(7) }],
      }),
    ).rejects.toThrow('Item unit is too long');

    await expect(
      gateway.issue({
        orderId: 'ORD_LONG_ITEM_REMARK',
        buyerName: 'A123',
        items: [{ name: 'item', quantity: 1, unitPrice: 105, remark: 'x'.repeat(121) }],
      }),
    ).rejects.toThrow('Item remark is too long');

    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('should validate carrier formats when remote validation is not skipped', async () => {
    const validationGateway = new UniversalInvoiceGateway({
      companyID: '12345675',
      userID: 'user',
      auth: 'password',
      apiKey: 'api-key',
      sellerID: '12345675',
      baseUrl: 'https://example.com',
    });

    await expect(validationGateway.isMobileBarcodeValid('/ABC1234')).resolves.toBe(true);
    await expect(validationGateway.isMobileBarcodeValid('ABC1234')).resolves.toBe(false);
    await expect(validationGateway.isLoveCodeValid('001')).resolves.toBe(true);
    await expect(validationGateway.isLoveCodeValid('AB1')).resolves.toBe(false);

    await expect(
      validationGateway.issue({
        orderId: 'ORD_BAD_MOBILE',
        buyerName: 'A123',
        carrier: InvoiceCarriers.MOBILE('ABC1234'),
        items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
      }),
    ).rejects.toThrow('Mobile barcode is invalid');

    await expect(
      validationGateway.issue({
        orderId: 'ORD_BAD_LOVE',
        buyerName: 'A123',
        carrier: InvoiceCarriers.LOVE_CODE('AB1'),
        items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
      }),
    ).rejects.toThrow('Love code is invalid');

    await expect(
      validationGateway.issue({
        orderId: 'ORD_BAD_MOICA',
        buyerName: 'A123',
        carrier: InvoiceCarriers.MOICA('BAD'),
        items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
      }),
    ).rejects.toThrow('MOICA code is invalid');
  });

  it('should void invoice', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        statusCode: '0',
        respData: {
          invNo: 'AB12345678',
          invDate: '20260430',
          invTime: '12:30:45',
          randomNumber: '1234',
        },
      },
    });

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        statusCode: '0',
        respData: {
          invNo: 'AB12345678',
          cancelDate: '20260501',
          cancelTime: '13:00:00',
        },
      },
    });

    const invoice = await gateway.issue({
      orderId: 'ORD004',
      buyerName: 'A123',
      items: [
        {
          name: 'item 1',
          quantity: 1,
          unitPrice: 105,
        },
      ],
    });

    await gateway.void(invoice, { reason: 'order cancelled' });

    expect(invoice.state).toBe(InvoiceState.VOID);
    expect(mockedAxios.post.mock.calls[1][0]).toBe('https://example.com/cancelInvoice');
  });

  it('should void B2B invoice with override order id', async () => {
    mockIssueSuccess();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        statusCode: '0',
        respData: {
          invNo: 'AB12345678',
          cancelDate: '20260501',
          cancelTime: '13:00:00',
        },
      },
    });

    const invoice = await gateway.issue({
      orderId: 'ORD_B2B_VOID',
      vatNumber: '24536806',
      buyerName: '買方公司',
      carrier: InvoiceCarriers.PRINT,
      items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
    });

    await gateway.void(invoice, { orderId: 'RETURN001', reason: 'order cancelled', remark: 'remark' });

    const request = mockedAxios.post.mock.calls[1][1] as UniversalRequestBody<Record<string, unknown>>;

    expect(request.reqData).toMatchObject({
      orderID: 'RETURN001',
      process_type: 'B',
      remark: 'remark',
    });
  });

  it('should reject void and allowance for non-issued invoice states', async () => {
    mockIssueSuccess();
    const invoice = await gateway.issue({
      orderId: 'ORD_STATE',
      buyerName: 'A123',
      items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
    });

    invoice.setVoid();

    await expect(gateway.void(invoice, { reason: 'again' })).rejects.toThrow('Invoice is not issued');
    await expect(gateway.allowance(invoice, [{ name: 'item', quantity: 1, unitPrice: 105 }])).rejects.toThrow(
      'Invoice is not issued',
    );
  });

  it('should create and invalidate allowance', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({
        data: {
          statusCode: '0',
          respData: {
            invNo: 'AB12345678',
            invDate: '20260430',
            invTime: '12:30:45',
            randomNumber: '1234',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          statusCode: '0',
          respData: {
            allowanceNumber: 'AL1234567890',
            allowanceDate: '20260501',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          statusCode: '0',
          respData: {
            allowanceNumber: 'AL1234567890',
            cancelDate: '20260502',
            cancelTime: '10:00:00',
          },
        },
      });

    const invoice = await gateway.issue({
      orderId: 'ORD005',
      buyerName: 'A123',
      items: [
        {
          name: 'item 1',
          quantity: 1,
          unitPrice: 105,
        },
      ],
    });

    await gateway.allowance(invoice, [
      {
        name: 'item 1',
        quantity: 1,
        unitPrice: 105,
      },
    ]);

    expect(invoice.allowances).toHaveLength(1);
    expect(invoice.nowAmount).toBe(0);

    await gateway.invalidAllowance(invoice.allowances[0]);

    expect(invoice.nowAmount).toBe(105);
    expect(mockedAxios.post.mock.calls[2][0]).toBe('https://example.com/cancelAllowance');
  });

  it('should create B2B allowance with options and tax-free detail', async () => {
    mockIssueSuccess();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        statusCode: '0',
        respData: {
          allowanceNumber: 'AL1234567890',
          allowanceDate: '20260501',
        },
      },
    });

    const invoice = await gateway.issue({
      orderId: 'ORD_B2B_ALLOWANCE',
      vatNumber: '24536806',
      buyerName: '買方公司',
      carrier: InvoiceCarriers.PRINT,
      items: [{ name: 'item', quantity: 2, unitPrice: 105 }],
    });

    await gateway.allowance(invoice, [{ name: 'free item', quantity: 1, unitPrice: 50, taxType: TaxType.TAX_FREE }], {
      salesReturnID: 'RETURN001',
      buyerName: '買方公司',
      buyerAddress: '台北市',
      notifyEmail: 'buyer@example.com',
      unitCode: 'POS02',
      allowanceType: '1',
      taxType: TaxType.TAX_FREE,
    });

    const request = mockedAxios.post.mock.calls[1][1] as UniversalRequestBody<{
      process_type: string;
      salesReturnID: string;
      salesReturnDetail: { unitprice: number; amount: number; taxType: string }[];
    }>;

    expect(request.reqData).toMatchObject({
      process_type: 'B',
      salesReturnID: 'RETURN001',
      buyerName: '買方公司',
      buyerAddress: '台北市',
      notifyEmail: 'buyer@example.com',
      unitCode: 'POS02',
      allowanceType: '1',
    });

    expect(request.reqData.salesReturnDetail[0]).toMatchObject({
      unitprice: 50,
      amount: 50,
      taxType: '3',
    });
  });

  it('should create mixed allowance with default taxed item type', async () => {
    mockIssueSuccess();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        statusCode: '0',
        respData: {
          allowanceNumber: 'AL1234567890',
          allowanceDate: '20260501',
        },
      },
    });

    const invoice = await gateway.issue({
      orderId: 'ORD_MIXED_ALLOWANCE',
      buyerName: 'A123',
      items: [
        { name: 'taxed item', quantity: 1, unitPrice: 105 },
        { name: 'free item', quantity: 1, unitPrice: 50, taxType: TaxType.TAX_FREE },
      ],
    });

    await gateway.allowance(invoice, [{ name: 'taxed item', quantity: 1, unitPrice: 105 }], {
      taxType: TaxType.MIXED,
    });

    const request = mockedAxios.post.mock.calls[1][1] as UniversalRequestBody<{
      salesReturnDetail: { taxType: string; unitprice: number }[];
    }>;

    expect(request.reqData.salesReturnDetail[0]).toMatchObject({
      taxType: '1',
      unitprice: 100,
    });
  });

  it('should invalidate B2B allowance with override sales return id and reason', async () => {
    mockIssueSuccess();
    mockedAxios.post
      .mockResolvedValueOnce({
        data: {
          statusCode: '0',
          respData: {
            allowanceNumber: 'AL1234567890',
            allowanceDate: '20260501',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          statusCode: '0',
          respData: {
            allowanceNumber: 'AL1234567890',
            cancelDate: '20260502',
            cancelTime: '10:00:00',
          },
        },
      });

    const invoice = await gateway.issue({
      orderId: 'ORD_B2B_INVALID_ALLOWANCE',
      vatNumber: '24536806',
      buyerName: '買方公司',
      carrier: InvoiceCarriers.PRINT,
      items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
    });

    await gateway.allowance(invoice, [{ name: 'item', quantity: 1, unitPrice: 105 }]);
    await gateway.invalidAllowance(invoice.allowances[0], {
      salesReturnID: 'RETURN_OVERRIDE',
      reason: 'custom reason',
    });

    const request = mockedAxios.post.mock.calls[2][1] as UniversalRequestBody<Record<string, unknown>>;

    expect(request.reqData).toMatchObject({
      salesReturnID: 'RETURN_OVERRIDE',
      process_type: 'B',
      cancelReason: 'custom reason',
    });
  });

  it('should reject invalid allowance input', async () => {
    mockIssueSuccess();
    const invoice = await gateway.issue({
      orderId: 'ORD_ALLOWANCE_ERR',
      buyerName: 'A123',
      items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
    });

    await expect(gateway.allowance(invoice, [{ name: 'item', quantity: 0, unitPrice: 105 }])).rejects.toThrow(
      'Allowance amount should more than zero',
    );

    await expect(gateway.allowance(invoice, [{ name: 'item', quantity: 2, unitPrice: 105 }])).rejects.toThrow(
      'No enough amount for allowance',
    );
  });

  it('should reject invalidating an already invalid allowance', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({
        data: {
          statusCode: '0',
          respData: {
            invNo: 'AB12345678',
            invDate: '20260430',
            invTime: '12:30:45',
            randomNumber: '1234',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          statusCode: '0',
          respData: {
            allowanceNumber: 'AL1234567890',
            allowanceDate: '20260501',
          },
        },
      });

    const invoice = await gateway.issue({
      orderId: 'ORD_INVALID_ALLOWANCE',
      buyerName: 'A123',
      items: [{ name: 'item', quantity: 1, unitPrice: 105 }],
    });

    await gateway.allowance(invoice, [{ name: 'item', quantity: 1, unitPrice: 105 }]);
    invoice.allowances[0].invalid();

    await expect(gateway.invalidAllowance(invoice.allowances[0])).rejects.toThrow('Allowance is not issued');
  });

  it('should query invoice by order id and rebuild detail model', async () => {
    const queryGateway = new UniversalInvoiceGateway({
      companyID: '12345675',
      userID: 'user',
      auth: 'password',
      apiKey: 'api-key',
      sellerID: '12345675',
      baseUrl: UniversalBaseUrls.DEVELOPMENT,
    });

    mockedAxios.post
      .mockResolvedValueOnce({
        data: {
          statusCode: '0',
          respData: {
            invNo: 'AB12345678',
            invDate: '20260430',
            invTime: '12:30:45',
            randomNumber: '1234',
            status: '0',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          statusCode: '0',
          respData: {
            invNo: 'AB12345678',
            sellerCompid: '12345675',
            buyerCompid: '0000000000',
            buyerName: 'A123',
            invDate: '20260430',
            amount: 100,
            tax: 5,
            total: 105,
            sellerInvStatus: '0',
            randomnumber: '1234',
            details: [
              {
                productName: 'item 1',
                qty: 1,
                unitPrice: 105,
                subtotoal: 105,
              },
            ],
          },
        },
      });

    const invoice = await queryGateway.query({ orderId: 'ORD006' });

    expect(invoice.invoiceNumber).toBe('AB12345678');
    expect(invoice.items).toEqual([
      {
        name: 'item 1',
        quantity: 1,
        unitPrice: 105,
      },
    ]);

    expect(mockedAxios.post.mock.calls[0][0]).toBe(`${UniversalBaseUrls.DEVELOPMENT}/queryInvoice`);
    expect(mockedAxios.post.mock.calls[1][0]).toBe(`${UniversalBaseUrls.DEVELOPMENT}/queryInvoiceDetail`);
  });

  it('should query invoice by invoice number and detect void state', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        statusCode: '0',
        respData: {
          invNo: 'AB12345678',
          sellerCompid: '12345675',
          buyerCompid: '0000000000',
          buyerName: 'A123',
          invDate: '20260430',
          freetaxsalesamount: 50,
          sellerInvStatus: '1',
          randomnumber: '1234',
          details: [
            {
              productName: 'free item',
              qty: 1,
              unitPrice: 50,
              subtotoal: 50,
            },
          ],
        },
      },
    });

    const invoice = await gateway.query({ invoiceNumber: 'AB12345678', issuedOn: new Date('2026-04-30T00:00:00Z') });

    expect(invoice.state).toBe(InvoiceState.VOID);
    expect(invoice.voidOn).toBeInstanceOf(Date);
    expect(invoice.taxType).toBe(TaxType.TAX_FREE);
    expect(mockedAxios.post.mock.calls[0][0]).toBe('https://example.com/queryInvoiceDetail');
  });

  it('should query invoice by string date and use missing detail fallbacks', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        statusCode: '0',
        respData: {
          details: [
            {
              subtotoal: 0,
            },
          ],
        },
      },
    });

    const invoice = await gateway.query({ invoiceNumber: 'AB12345678', issuedOn: '20260430' });

    expect(invoice.invoiceNumber).toBe('');
    expect(invoice.randomCode).toBe('');
    expect(invoice.sellerID).toBe('12345675');
    expect(invoice.buyerID).toBe('0000000000');
    expect(invoice.items).toEqual([{ name: '', quantity: 0, unitPrice: 0 }]);
    expect(invoice.taxType).toBe(TaxType.TAXED);
  });

  it('should query order detail with fallback invoice fields and mixed tax type', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({
        data: {
          statusCode: '0',
          respData: {
            invNo: 'AB12345678',
            invDate: '20260430',
            invTime: '12:30:45',
            randomNumber: '1234',
            status: '0',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          statusCode: '0',
          respData: {
            amount: 100,
            freetaxsalesamount: 50,
            sellerInvStatus: '0',
          },
        },
      });

    const invoice = await gateway.query({ orderId: 'ORD_QUERY_FALLBACK' });

    expect(invoice.invoiceNumber).toBe('AB12345678');
    expect(invoice.randomCode).toBe('1234');
    expect(invoice.taxType).toBe(TaxType.MIXED);
  });

  it('should query zero mixed and zero-only tax detail variants', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({
        data: {
          statusCode: '0',
          respData: {
            invNo: 'AB12345678',
            invDate: '20260430',
            sellerInvStatus: '0',
            amount: 100,
            zerotaxsalesamount: 50,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          statusCode: '0',
          respData: {
            invNo: 'CD12345678',
            invDate: '20260430',
            sellerInvStatus: '0',
            zerotaxsalesamount: 50,
          },
        },
      });

    const mixedInvoice = await gateway.query({ invoiceNumber: 'AB12345678', issuedOn: '20260430' });
    const zeroInvoice = await gateway.query({ invoiceNumber: 'CD12345678', issuedOn: '20260430' });

    expect(mixedInvoice.taxType).toBe(TaxType.MIXED);
    expect(zeroInvoice.taxType).toBe(TaxType.ZERO_TAX);
  });

  it('should throw when query response status is rejected', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({
        data: {
          statusCode: '0',
          respData: {
            invNo: 'AB12345678',
            invDate: '20260430',
            invTime: '12:30:45',
            randomNumber: '1234',
            status: '3',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          statusCode: '0',
          respData: {
            invNo: 'AB12345678',
            invDate: '20260430',
            sellerInvStatus: '0',
          },
        },
      });

    await expect(gateway.query({ orderId: 'ORD_REJECTED' })).rejects.toThrow('Universal invoice was rejected');
  });

  it('should throw API status description', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        statusCode: '2',
        statusDesc: '資料檢核錯誤',
      },
    });

    await expect(
      gateway.issue({
        orderId: 'ORD007',
        buyerName: 'A123',
        items: [
          {
            name: 'item 1',
            quantity: 1,
            unitPrice: 105,
          },
        ],
      }),
    ).rejects.toThrow('資料檢核錯誤');
  });

  it('should throw fallback API status message without status description', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        statusCode: '9',
      },
    });

    await expect(
      gateway.issue({
        orderId: 'ORD008',
        buyerName: 'A123',
        items: [
          {
            name: 'item 1',
            quantity: 1,
            unitPrice: 105,
          },
        ],
      }),
    ).rejects.toThrow('Universal invoice API failed with status 9');
  });
});
