import { ModuleMetadata, Type } from '@nestjs/common';
import { PaymentsModuleOptionsDto } from './payments-module-options.dto';
import { PaymentsModuleOptionFactory } from './payments-option-factory';

export interface PaymentsModuleAsyncOptionsDto extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (...args: any[]) => Promise<PaymentsModuleOptionsDto> | PaymentsModuleOptionsDto;
  inject?: any[];
  useClass?: Type<PaymentsModuleOptionFactory>;
  useExisting?: Type<PaymentsModuleOptionFactory>;
}
