import { PaymentGateway } from '@rytass/payments';

export interface PaymentsModuleOptionsDto {
  paymentGateway: PaymentGateway;
}
