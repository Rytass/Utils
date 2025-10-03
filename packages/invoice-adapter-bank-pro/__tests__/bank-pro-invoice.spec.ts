import { BankProInvoiceOptions } from '../src/typings';
import { BankProInvoice } from '../src/bank-pro-invoice';
import { InvoiceState, TaxType } from '../../invoice/src/typings';

describe('Bank Pro Invoice', () => {
  const issuedOn = new Date();
  const items = [
    {
      name: 'item1',
      unitPrice: 100,
      quantity: 10,
      unit: 'kg',
      id: '0001',
      barcode: '1234567890123',
      spec: 'spec1',
      remark: 'remark1',
    },
    {
      name: 'item2',
      unitPrice: 200,
      quantity: 20,
      unit: 'kg',
      id: '0002',
      barcode: '1234567890124',
      spec: 'spec2',
      remark: 'remark2',
    },
  ];

  const options: BankProInvoiceOptions = {
    items: items,
    issuedOn: issuedOn,
    invoiceNumber: '12345678901234567890',
    randomCode: 'abcdefghijklmnop',
    orderId: 'OOID101',
    taxType: TaxType.TAXED,
  };

  it('should integrate correctly', () => {
    const invoice = new BankProInvoice(options);

    expect(invoice).toEqual({
      issuedOn: issuedOn,
      items: items,
      nowAmount: 5000,
      issuedAmount: 5000,
      randomCode: 'abcdefghijklmnop',
      invoiceNumber: '12345678901234567890',
      orderId: 'OOID101',
      taxType: TaxType.TAXED,
      allowances: [],
      voidOn: null,
      state: InvoiceState.ISSUED,
    });
  });

  it('should setVoid', () => {
    const invoice = new BankProInvoice(options);
    const voidOn = new Date();

    invoice.setVoid(voidOn);

    expect(invoice.voidOn).toBe(voidOn);
    expect(invoice.state).toBe(InvoiceState.VOID);
  });
});
