import { PaymentsModuleOptionsDto } from './payments-module-options.dto';

export interface PaymentsModuleOptionFactory {
  createPaymentsOptions():
    | Promise<PaymentsModuleOptionsDto>
    | PaymentsModuleOptionsDto;
}
