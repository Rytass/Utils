import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type';
import { DataSource } from 'typeorm';

const models: [symbol: symbol, cls: EntityClassOrSchema][] = [];

@Module({
  imports: [TypeOrmModule.forFeature(models.map(([, entity]) => entity))],
  providers: models.map(([symbol, entity]) => ({
    provide: symbol,
    inject: [DataSource],
    useFactory: (dataSource: DataSource) => dataSource.getRepository(entity),
  })),
  exports: models.map(([symbol]) => symbol),
})
export class WMSModelsModule {}
