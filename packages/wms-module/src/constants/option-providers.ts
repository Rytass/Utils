import { Provider } from '@nestjs/common';
import { WmsModuleOptions } from '../typings/wms-module-options.interface';
import {
  PROVIDE_LOCATION_ENTITY,
  WMS_MODULE_OPTIONS,
} from '../typings/wms-module-providers';

export const OptionProviders: Provider[] = [
  {
    provide: PROVIDE_LOCATION_ENTITY,
    useFactory: (options?: WmsModuleOptions) => options?.locationEntity ?? null,
    inject: [WMS_MODULE_OPTIONS],
  },
];
