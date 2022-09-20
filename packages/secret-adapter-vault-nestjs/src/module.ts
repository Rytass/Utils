import { DynamicModule, Module } from '@nestjs/common';
import { VAULT_PATH_TOKEN } from './constants';
import { VaultHostModule } from './host.module';
import { VaultModuleOptions } from './interfaces';
import { VaultService } from './service';

@Module({
	imports: [VaultHostModule],
	exports: [VaultHostModule],
})
export class VaultModule {
	static forRoot(options: VaultModuleOptions = { path: '/' }): DynamicModule {
		return {
			module: VaultModule,
			global: options.isGlobal,
			providers: [
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
