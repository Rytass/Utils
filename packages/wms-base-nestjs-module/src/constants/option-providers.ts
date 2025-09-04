import { Provider } from '@nestjs/common';
import { WMSBaseModuleOptions } from '../typings/wms-base-module-options.interface';
import {
  ALLOW_NEGATIVE_STOCK,
  PROVIDE_BATCH_ENTITY,
  PROVIDE_LOCATION_ENTITY,
  PROVIDE_MATERIAL_ENTITY,
  PROVIDE_ORDER_ENTITY,
  PROVIDE_STOCK_ENTITY,
  PROVIDE_WAREHOUSE_MAP_ENTITY,
  WMS_MODULE_OPTIONS,
} from '../typings/wms-base-module-providers';

export const OptionProviders: Provider[] = [
  {
    provide: PROVIDE_LOCATION_ENTITY,
    useFactory: (options?: WMSBaseModuleOptions) => options?.locationEntity ?? null,
    inject: [WMS_MODULE_OPTIONS],
  },
  {
    provide: PROVIDE_MATERIAL_ENTITY,
    useFactory: (options?: WMSBaseModuleOptions) => options?.materialEntity ?? null,
    inject: [WMS_MODULE_OPTIONS],
  },
  {
    provide: PROVIDE_BATCH_ENTITY,
    useFactory: (options?: WMSBaseModuleOptions) => options?.batchEntity ?? null,
    inject: [WMS_MODULE_OPTIONS],
  },
  {
    provide: PROVIDE_ORDER_ENTITY,
    useFactory: (options?: WMSBaseModuleOptions) => options?.orderEntity ?? null,
    inject: [WMS_MODULE_OPTIONS],
  },
  {
    provide: PROVIDE_STOCK_ENTITY,
    useFactory: (options?: WMSBaseModuleOptions) => options?.stockEntity ?? null,
    inject: [WMS_MODULE_OPTIONS],
  },
  {
    provide: ALLOW_NEGATIVE_STOCK,
    useFactory: (options?: WMSBaseModuleOptions) => options?.allowNegativeStock ?? false,
    inject: [WMS_MODULE_OPTIONS],
  },
  {
    provide: PROVIDE_WAREHOUSE_MAP_ENTITY,
    useFactory: (options?: WMSBaseModuleOptions) => options?.warehouseMapEntity ?? null,
    inject: [WMS_MODULE_OPTIONS],
  },
];
