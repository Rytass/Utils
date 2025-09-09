import { ModuleMetadata, Type, InjectionToken, OptionalFactoryDependency } from '@nestjs/common';
import { PaymentsModuleOptionsDto } from './payments-module-options.dto';
import { PaymentsModuleOptionFactory } from './payments-option-factory';

export interface PaymentsModuleAsyncOptionsDto extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (...args: unknown[]) => Promise<PaymentsModuleOptionsDto> | PaymentsModuleOptionsDto;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
  useClass?: Type<PaymentsModuleOptionFactory>;
  useExisting?: Type<PaymentsModuleOptionFactory>;
}
