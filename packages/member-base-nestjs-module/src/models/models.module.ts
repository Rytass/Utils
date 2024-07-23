import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberEntity, MemberRepo } from './member.entity';
import { DataSource } from 'typeorm';

const models = [
  [MemberRepo, MemberEntity],
] as [symbol, typeof MemberEntity][];

@Module({
  imports: [TypeOrmModule.forFeature(models.map(model => model[1]))],
  providers: models.map(([symbol, entity]) => ({
    provide: symbol,
    useFactory: (dataSource: DataSource) => dataSource.getRepository(entity),
    inject: [DataSource],
  })),
  exports: models.map(model => model[0]),
})
export class MemberBaseModelsModule {}
