import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VAULT_PATH_TOKEN } from './constants';
import { VaultModuleOptions } from './interfaces';
import { VaultService } from './service';

@Global()
@Module({})
export class VaultModule {
  static forRoot(options: VaultModuleOptions = { path: '/' }): DynamicModule {
    return {
      imports: [
        ConfigModule.forRoot({
          envFilePath: options.fallbackFile,
        }),
      ],
      module: VaultModule,
      providers: [
        ConfigService,
        {
          provide: VAULT_PATH_TOKEN,
          useValue: options.path,
        },
        VaultService,
      ],
      exports: [VaultService],
    };
  }
}
