import { InvoiceAllowanceState, TaxType } from '../../invoice/src/typings';
import { UniversalAllowance } from '../src/universal-allowance';
import { UniversalInvoice } from '../src/universal-invoice';

describe('UniversalAllowance', () => {
  it('should mark allowance invalid and restore parent now amount', () => {
    const invoice = new UniversalInvoice({
      orderId: 'ORD001',
      sellerID: '12345675',
      buyerID: '0000000000',
      items: [
        {
          name: 'item 1',
          quantity: 1,
          unitPrice: 100,
        },
      ],
      issuedOn: new Date('2026-04-30T00:00:00.000Z'),
      invoiceNumber: 'AB12345678',
      randomCode: '1234',
      taxType: TaxType.TAXED,
    });

    const allowance = new UniversalAllowance({
      allowanceNumber: 'AL1234567890',
      allowanceDate: '20260430',
      allowancePrice: 50,
      allowancedOn: new Date('2026-04-30T00:00:00.000Z'),
      remainingAmount: 50,
      items: [
        {
          name: 'item 1',
          quantity: 1,
          unitPrice: 50,
        },
      ],
      parentInvoice: invoice,
      status: InvoiceAllowanceState.ISSUED,
      invalidOn: null,
      salesReturnID: 'ORD001-A1',
    });

    invoice.addAllowance(allowance);
    allowance.invalid(new Date('2026-05-01T00:00:00.000Z'));

    expect(allowance.status).toBe(InvoiceAllowanceState.INVALID);
    expect(invoice.nowAmount).toBe(100);
  });
});
