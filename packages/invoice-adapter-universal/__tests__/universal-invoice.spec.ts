import { InvoiceAllowanceState, InvoiceState, TaxType } from '../../invoice/src/typings';
import { UniversalAllowance } from '../src/universal-allowance';
import { UniversalInvoice } from '../src/universal-invoice';

describe('UniversalInvoice', () => {
  const invoice = new UniversalInvoice({
    orderId: 'ORD001',
    sellerID: '12345675',
    buyerID: '0000000000',
    buyerName: 'A123',
    items: [
      {
        name: 'item 1',
        quantity: 2,
        unitPrice: 100,
      },
    ],
    issuedOn: new Date('2026-04-30T00:00:00.000Z'),
    invoiceNumber: 'AB12345678',
    randomCode: '1234',
    taxType: TaxType.TAXED,
  });

  it('should initialize invoice state and amount', () => {
    expect(invoice.issuedAmount).toBe(200);
    expect(invoice.nowAmount).toBe(200);
    expect(invoice.state).toBe(InvoiceState.ISSUED);
  });

  it('should set void state', () => {
    const voidOn = new Date('2026-05-01T00:00:00.000Z');
    const target = new UniversalInvoice({ ...invoice, issuedOn: invoice.issuedOn });

    target.setVoid(voidOn);

    expect(target.voidOn).toBe(voidOn);
    expect(target.state).toBe(InvoiceState.VOID);
  });

  it('should add allowance and update now amount', () => {
    const target = new UniversalInvoice({ ...invoice, issuedOn: invoice.issuedOn });
    const allowance = new UniversalAllowance({
      allowanceNumber: 'AL1234567890',
      allowanceDate: '20260430',
      allowancePrice: 50,
      allowancedOn: new Date('2026-04-30T00:00:00.000Z'),
      remainingAmount: 150,
      items: [
        {
          name: 'item 1',
          quantity: 1,
          unitPrice: 50,
        },
      ],
      parentInvoice: target,
      status: InvoiceAllowanceState.ISSUED,
      invalidOn: null,
      salesReturnID: 'ORD001-A1',
    });

    target.addAllowance(allowance);

    expect(target.allowances).toHaveLength(1);
    expect(target.nowAmount).toBe(150);
    expect(target.state).toBe(InvoiceState.ALLOWANCED);
  });

  it('should initialize now amount with existing issued allowances only', () => {
    const target = new UniversalInvoice({
      ...invoice,
      issuedOn: invoice.issuedOn,
      allowances: [
        new UniversalAllowance({
          allowanceNumber: 'AL1234567890',
          allowanceDate: '20260430',
          allowancePrice: 50,
          allowancedOn: new Date('2026-04-30T00:00:00.000Z'),
          remainingAmount: 150,
          items: [],
          parentInvoice: invoice,
          status: InvoiceAllowanceState.ISSUED,
          invalidOn: null,
          salesReturnID: 'ORD001-A1',
        }),
        new UniversalAllowance({
          allowanceNumber: 'AL1234567891',
          allowanceDate: '20260430',
          allowancePrice: 20,
          allowancedOn: new Date('2026-04-30T00:00:00.000Z'),
          remainingAmount: 180,
          items: [],
          parentInvoice: invoice,
          status: InvoiceAllowanceState.INVALID,
          invalidOn: new Date('2026-05-01T00:00:00.000Z'),
          salesReturnID: 'ORD001-A2',
        }),
      ],
    });

    expect(target.nowAmount).toBe(150);
  });
});
