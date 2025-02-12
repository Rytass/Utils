import { DateTime } from 'luxon';
import {
  BankProInvoiceGateway,
  BankProInvoiceGatewayOptions,
  BankProInvoicePosIssueOptions,
  InvoiceCarrierType,
  TaxType,
} from '../src';

describe('BankProInvoiceGateway posIssue', () => {
  const now = new Date();

  const gatewayOptions: BankProInvoiceGatewayOptions = {
    user: 'testUser',
    password: 'testPassword',
    systemOID: 123,
    sellerBAN: '12345678',
  };

  const posIssueOptions: BankProInvoicePosIssueOptions = {
    orderId: 'order123',
    issueAt: now,
    items: [
      {
        name: 'Item 1',
        quantity: 1,
        unitPrice: 100,
        taxType: TaxType.TAXED,
      },
    ],
    registerCode: 'REG01',
    storeName: 'Test Store',
    storeCode: 'STORE',
  };

  let gateway: BankProInvoiceGateway;

  beforeEach(() => {
    gateway = new BankProInvoiceGateway(gatewayOptions);
  });

  it('should throw error if carrier info is provided', () => {
    expect(() =>
      gateway.posIssue({
        ...posIssueOptions,
        carrier: {
          type: InvoiceCarrierType.MOBILE,
          code: '/123456',
        },
      }),
    ).toThrow('Carrier information is not supported for POS invoice');
  });

  it('should generate correct POS txt format', () => {
    const result = gateway.posIssue(posIssueOptions);

    // Split result by pipe to check each field
    const [header] = result.split('\n');

    const headerField = header.split('|');

    expect(headerField[0]).toBe('M'); // FileType
    expect(headerField[1]).toBe('1'); // State
    expect(headerField[2]).toBe('12345678'); // SellerBAN
    expect(headerField[3]).toBe('STORE'); // StoreCode
    expect(headerField[4]).toBe('Test Store'); // StoreName
    expect(headerField[5]).toBe('REG01'); // RegisterCode
    expect(headerField[6]).toBe('order123'); // OrderNo
    expect(headerField[7]).toBe(''); // InvoiceNo
    expect(headerField[8]).toBe(
      `${DateTime.fromJSDate(now).toFormat('yyyy/MM/dd HH:mm:ss')}`,
    ); // InvoiceDate

    expect(headerField[9]).toBe(''); // AllowanceDate
    expect(headerField[10]).toBe(''); // BuyerBAN
    expect(headerField[11]).toBe('N'); // PrintMark
    expect(headerField[12]).toBe(''); // MemberId
    expect(headerField[13]).toBe(''); // GroupMark
    expect(headerField[14]).toBe(''); // SalesAmt
    expect(headerField[15]).toBe(''); // FreeTaxSalesAmt
    expect(headerField[16]).toBe(''); // ZeroTaxSalesAmt
    expect(headerField[17]).toBe(''); // TaxAmt (5%)
    expect(headerField[18]).toBe('100'); // TotalAmt
    expect(headerField[19]).toBe('1'); // TaxType
    expect(headerField[20]).toBe('0.05'); // TaxRate
    expect(headerField[21]).toBe(''); // CarrierType
    expect(headerField[22]).toBe(''); // CarrierId1
    expect(headerField[23]).toBe(''); // CarrierId2
    expect(headerField[24]).toBe(''); // NpoBan
    expect(headerField[25]).toBe(''); // RandomNumber
    expect(headerField[26]).toBe(''); // MainRemark
    expect(headerField[27]).toBe(''); // Buyer
    expect(headerField[28]).toBe(''); // CancelReason
    expect(headerField[29]).toBe(''); // ReturnTaxDocumentNo
    expect(headerField[30]).toBe(''); // Remark
  });

  it('should handle multiple items correctly', () => {
    const result = gateway.posIssue({
      ...posIssueOptions,
      items: [
        {
          name: 'Item 1',
          quantity: 1,
          unitPrice: 100,
          taxType: TaxType.TAXED,
        },
        {
          name: 'Item 2',
          quantity: 2,
          unitPrice: 50,
          taxType: TaxType.TAXED,
        },
      ],
    });

    const [header, ...details] = result.split('\n');

    const headerFields = header.split('|');

    expect(headerFields[18]).toBe('200'); // TotalAmt (100 + (50 * 2))

    expect(details).toHaveLength(2); // Should have 2 detail records

    const expectedDetails = [
      {
        name: 'Item 1',
        quantity: 1,
        sequenceNo: '1',
        unitPrice: 100,
      },
      {
        name: 'Item 2',
        sequenceNo: '2',
        quantity: 2,
        unitPrice: 50,
      },
    ];

    details.forEach((detail, index) => {
      const detailFields = detail.split('|');

      expect(detailFields[0]).toBe('D'); // FileType
      expect(detailFields[1]).toBe(expectedDetails[index].sequenceNo); // SequenceNo
      expect(detailFields[2]).toBe(expectedDetails[index].name); // ItemName
      expect(detailFields[3]).toBe(expectedDetails[index].quantity.toString()); // Qty
      expect(detailFields[4]).toBe(''); // Unit
      expect(detailFields[5]).toBe(expectedDetails[index].unitPrice.toString()); // UnitPrice
      expect(detailFields[6]).toBe(''); // Amount
      expect(detailFields[7]).toBe(''); // TaxType
      expect(detailFields[8]).toBe(
        (
          expectedDetails[index].unitPrice * expectedDetails[index].quantity
        ).toString(),
      ); // TotalAmt

      expect(detailFields[9]).toBe(''); // RelateNumber
      expect(detailFields[10]).toBe(''); // Remark
    });
  });
});
