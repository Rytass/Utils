import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OidcPayloadEntity, OidcPayloadRepo } from './oidc-payload.entity';
import { OidcClientEntity, OidcClientRepo } from './oidc-client.entity';

/**
 * Registers the OIDC provider entities.
 *
 * Deliberately NOT part of MemberBaseModelsModule: these tables must only come
 * into existence for applications that actually expose an OIDC endpoint. With
 * `autoLoadEntities`, an entity reaches the schema only once a module
 * registering it enters the Nest module graph, so not importing the provider
 * module means not creating the tables.
 */
@Module({
  imports: [TypeOrmModule.forFeature([OidcPayloadEntity, OidcClientEntity])],
  providers: [
    {
      provide: OidcPayloadRepo,
      useFactory: (dataSource: DataSource): Repository<OidcPayloadEntity> =>
        dataSource.getRepository(OidcPayloadEntity),
      inject: [DataSource],
    },
    {
      provide: OidcClientRepo,
      useFactory: (dataSource: DataSource): Repository<OidcClientEntity> => dataSource.getRepository(OidcClientEntity),
      inject: [DataSource],
    },
  ],
  exports: [OidcPayloadRepo, OidcClientRepo],
})
export class MemberBaseOidcModelsModule {}
