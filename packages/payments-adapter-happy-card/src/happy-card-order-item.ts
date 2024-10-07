import { PaymentItem } from '@rytass/payments';

export class HappyCardOrderItem implements PaymentItem {
  name: string;
  unitPrice: number;
  quantity: number;

  constructor(options: PaymentItem) {
    this.name = options.name;
    this.unitPrice = options.unitPrice;
    this.quantity = options.quantity;
  }
}
