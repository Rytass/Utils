import { DynamicModule, Module } from '@nestjs/common';
import { WMSModelsModule } from './models/wms-models.module';
import { LocationService } from './services/location.service';
import { WmsModuleOptions } from './typings/wms-module-options.interface';

@Module({
  imports: [WMSModelsModule],
  exports: [LocationService],
  providers: [LocationService],
})
export class WMSModule {
  static forRoot(options: WmsModuleOptions): DynamicModule {
    return {
      module: WMSModule,
    };
  }

  static forRootAsync(): DynamicModule {
    return {
      module: WMSModule,
    };
  }
}
