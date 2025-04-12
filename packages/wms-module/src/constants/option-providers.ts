import { Provider } from '@nestjs/common';
import { WmsModuleOptions } from '../typings/wms-module-options.interface';
import {
  PROVIDE_BATCH_ENTITY,
  PROVIDE_LOCATION_ENTITY,
  PROVIDE_MATERIAL_ENTITY,
  WMS_MODULE_OPTIONS,
} from '../typings/wms-module-providers';

export const OptionProviders: Provider[] = [
  {
    provide: PROVIDE_LOCATION_ENTITY,
    useFactory: (options?: WmsModuleOptions) => options?.locationEntity ?? null,
    inject: [WMS_MODULE_OPTIONS],
  },
  {
    provide: PROVIDE_MATERIAL_ENTITY,
    useFactory: (options?: WmsModuleOptions) => options?.materialEntity ?? null,
    inject: [WMS_MODULE_OPTIONS],
  },
  {
    provide: PROVIDE_BATCH_ENTITY,
    useFactory: (options?: WmsModuleOptions) => options?.batchEntity ?? null,
    inject: [WMS_MODULE_OPTIONS],
  },
];
