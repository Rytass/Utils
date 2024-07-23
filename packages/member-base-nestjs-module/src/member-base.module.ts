import { Module } from '@nestjs/common';
import { MemberBaseModelsModule } from './models/models.module';
import { MemberBaseService } from './services/member-base.service';

@Module({
  imports: [MemberBaseModelsModule],
  providers: [MemberBaseService],
  exports: [
    MemberBaseModelsModule,
    MemberBaseService,
  ],
})
export class MemberBaseModule {}
