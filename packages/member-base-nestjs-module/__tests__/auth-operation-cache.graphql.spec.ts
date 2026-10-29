import 'reflect-metadata';
import { Injectable, Module } from '@nestjs/common';
import type { ExecutionContext, Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  AbstractGraphQLDriver,
  Args,
  Field,
  GqlExecutionContext,
  GraphQLModule,
  GraphQLSchemaHost,
  ID,
  Int,
  ObjectType,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { graphql } from 'graphql';
import type { ExecutionResult } from 'graphql';
import { newEnforcer, newModelFromString } from 'casbin';
import jwt from 'jsonwebtoken';
import { CasbinGuard } from '../src/guards/casbin.guard';
import { AllowActions } from '../src/decorators/action.decorator';
import { OptionProviders } from '../src/constants/option-providers';
import { CASBIN_MODEL } from '../src/constants/casbin-models/rbac-with-domains';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_SECRET,
  ACCESS_TOKEN_VERIFICATION_CACHE_SCOPE,
  CASBIN_ENFORCER,
  CASBIN_PERMISSION_CHECKER,
  CASBIN_PERMISSION_DECORATOR,
  COOKIE_MODE,
  ENABLE_GLOBAL_GUARD,
  MEMBER_BASE_MODULE_OPTIONS,
} from '../src/typings/member-base.tokens';
import type { MemberBaseModuleOptionsDTO } from '../src/typings/member-base-module-options.dto';

/**
 * The real Nest GraphQL pipeline — field guards through fieldResolverEnhancers,
 * a real Casbin enforcer and real JWTs — executed with graphql-js instead of an
 * HTTP server. Only the schema is needed, so the driver does nothing.
 */
@Injectable()
class SchemaOnlyDriver extends AbstractGraphQLDriver {
  async start(): Promise<void> {}

  async stop(): Promise<void> {}
}

@ObjectType()
class Row {
  @Field(() => ID)
  id!: string;

  @Field()
  projectId!: string;
}

@Resolver(() => Row)
class RowResolver {
  @Query(() => [Row])
  @AllowActions([['row', 'list']])
  rows(@Args('count', { type: () => Int }) count: number): Row[] {
    return Array.from({ length: count }, (_, index) => ({ id: `${index}`, projectId: index % 2 ? 'b' : 'a' }));
  }

  @ResolveField(() => String)
  @AllowActions([['row', 'name']])
  name(@Parent() row: Row): string {
    return `row-${row.id}`;
  }

  @ResolveField(() => String, { nullable: true })
  @AllowActions([['row', 'secret']])
  secret(@Parent() row: Row): string {
    return `secret-${row.projectId}`;
  }
}

const SECRET = 'graphql-spec-secret';
const MEMBER_ID = 'member-1';
const QUERY = '{ rows(count: 50) { id name secret } }';

// `secret` is decided in the row's own project, everything else in the tenant.
const resolveDomains = ({ context }: { context?: ExecutionContext }): string[] => {
  const gql = GqlExecutionContext.create(context as ExecutionContext);
  const parent = gql.getRoot<Row | undefined>();

  return gql.getInfo().fieldName === 'secret' && parent ? [`project:${parent.projectId}`] : ['tenant'];
};

const findProvider = (token: symbol): Provider =>
  OptionProviders.find(provider => (provider as { provide?: unknown }).provide === token) as Provider;

interface Harness {
  run: () => Promise<ExecutionResult>;
  enforce: jest.SpyInstance;
  verify: jest.SpyInstance;
}

const createHarness = async (options: MemberBaseModuleOptionsDTO): Promise<Harness> => {
  const enforcer = await newEnforcer(newModelFromString(CASBIN_MODEL));

  await enforcer.addPolicy('viewer', 'tenant', 'row', 'list');
  await enforcer.addPolicy('viewer', 'tenant', 'row', 'name');
  await enforcer.addPolicy('viewer', 'project:a', 'row', 'secret');
  await enforcer.addGroupingPolicy(MEMBER_ID, 'viewer', 'tenant');
  await enforcer.addGroupingPolicy(MEMBER_ID, 'viewer', 'project:a');

  @Module({
    imports: [
      GraphQLModule.forRoot({ driver: SchemaOnlyDriver, autoSchemaFile: true, fieldResolverEnhancers: ['guards'] }),
    ],
    providers: [
      RowResolver,
      { provide: MEMBER_BASE_MODULE_OPTIONS, useValue: options },
      findProvider(CASBIN_PERMISSION_CHECKER),
      findProvider(ACCESS_TOKEN_VERIFICATION_CACHE_SCOPE),
      { provide: COOKIE_MODE, useValue: false },
      { provide: CASBIN_ENFORCER, useValue: enforcer },
      { provide: ACCESS_TOKEN_SECRET, useValue: SECRET },
      { provide: ENABLE_GLOBAL_GUARD, useValue: true },
      { provide: CASBIN_PERMISSION_DECORATOR, useValue: AllowActions },
      { provide: ACCESS_TOKEN_COOKIE_NAME, useValue: 'access_token' },
      { provide: APP_GUARD, useClass: CasbinGuard },
    ],
  })
  class HarnessModule {}

  const moduleRef = await Test.createTestingModule({ imports: [HarnessModule] }).compile();
  const app = moduleRef.createNestApplication();

  await app.init();

  const { schema } = app.get(GraphQLSchemaHost);
  const token = jwt.sign({ id: MEMBER_ID }, SECRET, { expiresIn: 60 });
  const enforce = jest.spyOn(enforcer, 'enforce');
  const verify = jest.spyOn(jwt, 'verify');

  return {
    enforce,
    verify,
    run: () =>
      graphql({
        schema,
        source: QUERY,
        contextValue: { req: { headers: { authorization: `Bearer ${token}` } } },
      }),
  };
};

const deniedPaths = (result: ExecutionResult): string[] =>
  (result.errors ?? []).map(error => (error.path ?? []).join('.')).sort();

describe('operation cache through the Nest GraphQL field-guard pipeline', () => {
  afterEach(() => jest.restoreAllMocks());

  it('checks every field when left off', async () => {
    const harness = await createHarness({ casbinDomainResolver: resolveDomains });
    const result = await harness.run();

    expect(deniedPaths(result)).toHaveLength(25);
    expect(harness.enforce).toHaveBeenCalledTimes(101);
    expect(harness.verify).toHaveBeenCalledTimes(101);
  });

  it('verifies the token once per operation with the same answers', async () => {
    const off = await (await createHarness({ casbinDomainResolver: resolveDomains })).run();

    jest.restoreAllMocks();

    const harness = await createHarness({
      casbinDomainResolver: resolveDomains,
      accessTokenVerificationCacheScope: 'operation',
    });

    const on = await harness.run();

    expect(deniedPaths(on)).toEqual(deniedPaths(off));
    expect(on.data).toEqual(off.data);
    expect(harness.enforce).toHaveBeenCalledTimes(101);
    expect(harness.verify).toHaveBeenCalledTimes(1);
  });
});
