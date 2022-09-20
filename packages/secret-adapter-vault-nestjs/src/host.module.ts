import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VAULT_PATH_TOKEN } from './constants';

@Global()
@Module({
  imports: [ConfigModule.forRoot()],
  providers: [
    {
      provide: VAULT_PATH_TOKEN,
      useValue: '/',
    },
    ConfigService,
  ],
  exports: [VAULT_PATH_TOKEN, ConfigService],
})
export class VaultHostModule {}
