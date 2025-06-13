import { Module, DynamicModule } from '@nestjs/common';
import { CmsService } from './cms.service';

@Module({})
export class CmsBaseModule {
  static forRoot(options: { enableLogging?: boolean }): DynamicModule {
    return {
      module: CmsBaseModule,
      providers: [
        {
          provide: 'CMS_OPTIONS',
          useValue: options,
        },
        CmsService,
      ],
      exports: [CmsService],
    };
  }
}
