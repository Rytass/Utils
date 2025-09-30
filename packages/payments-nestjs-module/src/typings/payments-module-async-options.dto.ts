import { ModuleMetadata, Type, InjectionToken, OptionalFactoryDependency } from '@nestjs/common';
import { PaymentsModuleOptionsDto } from './payments-module-options.dto';
import { PaymentsModuleOptionFactory } from './payments-option-factory';

export interface PaymentsModuleAsyncOptionsDto extends Pick<ModuleMetadata, 'imports'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory?: (...args: any[]) => Promise<PaymentsModuleOptionsDto> | PaymentsModuleOptionsDto;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
  useClass?: Type<PaymentsModuleOptionFactory>;
  useExisting?: Type<PaymentsModuleOptionFactory>;
}
