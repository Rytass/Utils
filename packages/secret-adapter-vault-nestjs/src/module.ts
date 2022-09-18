import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VaultService } from './service';

@Module({
	imports: [ConfigModule.forRoot()],
	providers: [VaultService],
	exports: [VaultService],
})
export class VaultModule {}
