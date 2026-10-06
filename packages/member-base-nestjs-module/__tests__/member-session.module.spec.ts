import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entity, getMetadataArgsStorage, type Repository } from 'typeorm';
import { verify as verifyJWT } from 'jsonwebtoken';
import { MemberBaseModule } from '../src/member-base.module';
import { MemberBaseService } from '../src/services/member-base.service';
import { MemberSessionService } from '../src/services/member-session.service';
import { BaseMemberEntity } from '../src/models/base-member.entity';
import { MemberLoginLogEntity } from '../src/models/member-login-log.entity';
import { MemberPasswordHistoryEntity } from '../src/models/member-password-history.entity';
import { MemberOAuthRecordEntity } from '../src/models/member-oauth-record.entity';
import { MemberSessionEntity } from '../src/models/member-session.entity';
import { RESOLVED_MEMBER_SESSION_REPO, SESSION_ROTATION_GRACE_SECONDS } from '../src/typings/member-base.tokens';
import type { MemberBaseModuleOptionsDTO } from '../src/typings/member-base-module-options.dto';
import { RefreshTokenReuseDetectedError, SessionRevokedError } from '../src/constants/errors/base.error';

const REFRESH_TOKEN_SECRET = 'refresh-secret';
const PASSWORD = 'Passw0rd-one';

// The package's entities declare Postgres types; give sqlite ones it accepts.
// Only this file's module registry is touched.
const SQLITE_TYPES: Record<string, string> = { timestamptz: 'datetime', cidr: 'varchar', int2: 'smallint' };

for (const column of getMetadataArgsStorage().columns) {
  if (typeof column.options.type === 'string' && column.options.type in SQLITE_TYPES) {
    column.options.type = SQLITE_TYPES[column.options.type] as typeof column.options.type;
  }

  if (column.options.default === 'now()') {
    column.options.default = (): string => 'CURRENT_TIMESTAMP';
  }
}

@Entity('custom_member_sessions')
class CustomSessionEntity extends MemberSessionEntity {}

const ENTITIES = [
  BaseMemberEntity,
  MemberLoginLogEntity,
  MemberPasswordHistoryEntity,
  MemberOAuthRecordEntity,
  MemberSessionEntity,
  CustomSessionEntity,
];

const boot = async (options: MemberBaseModuleOptionsDTO = {}): Promise<TestingModule> => {
  const moduleRef = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({ type: 'sqlite', database: ':memory:', entities: ENTITIES, synchronize: true }),
      MemberBaseModule.forRoot({
        refreshTokenSecret: REFRESH_TOKEN_SECRET,
        accessTokenSecret: 'access-secret',
        enableGlobalGuard: false,
        loginLogEnabled: false,
        linkExistingAccount: false,
        ...options,
      }),
    ],
  }).compile();

  await moduleRef.init();

  return moduleRef;
};

const sessionIdOf = (refreshToken: string): string =>
  (verifyJWT(refreshToken, REFRESH_TOKEN_SECRET) as { sid: string }).sid;

describe('MemberBaseModule session wiring', () => {
  let moduleRef: TestingModule;

  afterEach(async () => {
    await moduleRef.close();
  });

  it('should need no configuration: a login through the module opens a session and its token rotates', async () => {
    moduleRef = await boot();

    const service = moduleRef.get(MemberBaseService);
    const sessionRepo = moduleRef.get<Repository<MemberSessionEntity>>(RESOLVED_MEMBER_SESSION_REPO);

    await service.register('alice', PASSWORD);

    const login = await service.login('alice', PASSWORD);
    const refreshed = await service.refreshToken(login.refreshToken);

    expect(moduleRef.get(SESSION_ROTATION_GRACE_SECONDS)).toBe(10);
    expect(sessionRepo.metadata.tableName).toBe('member_sessions');
    expect(await sessionRepo.count()).toBe(1);
    expect(sessionIdOf(refreshed.refreshToken)).toBe(sessionIdOf(login.refreshToken));
  });

  it('should end the session on logout and refuse its refresh token', async () => {
    moduleRef = await boot();

    const service = moduleRef.get(MemberBaseService);

    await service.register('alice', PASSWORD);

    const login = await service.login('alice', PASSWORD);

    await service.revokeSessionByRefreshToken(login.refreshToken);

    await expect(service.refreshToken(login.refreshToken)).rejects.toBeInstanceOf(SessionRevokedError);
  });

  it('should apply sessionTracking.rotationGraceSeconds', async () => {
    moduleRef = await boot({ sessionTracking: { rotationGraceSeconds: 0 } });

    const service = moduleRef.get(MemberBaseService);

    await service.register('alice', PASSWORD);

    const login = await service.login('alice', PASSWORD);

    await service.refreshToken(login.refreshToken);

    await expect(service.refreshToken(login.refreshToken)).rejects.toBeInstanceOf(RefreshTokenReuseDetectedError);
  });

  it('should store sessions in the entity named by sessionTracking.sessionEntity', async () => {
    moduleRef = await boot({ sessionTracking: { sessionEntity: CustomSessionEntity } });

    const service = moduleRef.get(MemberBaseService);
    const custom = moduleRef.get<Repository<MemberSessionEntity>>(RESOLVED_MEMBER_SESSION_REPO);

    await service.register('alice', PASSWORD);
    await service.login('alice', PASSWORD);

    expect(custom.metadata.tableName).toBe('custom_member_sessions');
    expect(await custom.count()).toBe(1);
    expect(await moduleRef.get(MemberSessionService).purgeExpiredSessions()).toBe(0);
  });

  it.each([Infinity, 301, Number.NaN])('should refuse a grace window of %s at boot', async rotationGraceSeconds => {
    await expect(boot({ sessionTracking: { rotationGraceSeconds } })).rejects.toThrow(
      /rotationGraceSeconds must be a number of seconds from 0 to 300/,
    );

    moduleRef = await boot();
  });

  it('should refuse a negative grace window at boot', async () => {
    await expect(boot({ sessionTracking: { rotationGraceSeconds: -1 } })).rejects.toThrow(
      /rotationGraceSeconds must be a number of seconds from 0 to 300/,
    );

    // Give afterEach something to close.
    moduleRef = await boot();
  });
});
