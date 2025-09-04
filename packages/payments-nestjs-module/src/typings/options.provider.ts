import { PaymentGateway } from '@rytass/payments';
import { PaymentsModuleOptionsDto } from './payments-module-options.dto';
import { PAYMENTS_GATEWAY, PAYMENTS_MODULE_OPTIONS } from './symbol';

export const OptionsProviders = [
  {
    provide: PAYMENTS_GATEWAY,
    useFactory: (options: PaymentsModuleOptionsDto): PaymentGateway => options.paymentGateway,
    inject: [PAYMENTS_MODULE_OPTIONS],
  },
];
