import { Module } from '@nestjs/common';
import { MemberBaseModelsModule } from './models/models.module';
import { MemberBaseService } from './services/member-base.service';
import { MemberBaseAdminService } from './services/member-base-admin.service';

@Module({
  imports: [MemberBaseModelsModule],
  providers: [MemberBaseService, MemberBaseAdminService],
  exports: [MemberBaseModelsModule, MemberBaseService, MemberBaseAdminService],
})
export class MemberBaseModule {}
