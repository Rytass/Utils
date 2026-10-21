import { DynamicModule, Logger, Module, Type } from '@nestjs/common';
import { TurnkeyBaseModule } from '@rytass/invoice-turnkey-base-nestjs-module';
import { createTurnkeyMutationResolver } from './mutations/turnkey.mutations';
import { TurnkeyJSONScalar } from './dto/turnkey-json.scalar';
import { createTurnkeyQueryResolver } from './queries/turnkey.queries';
import {
  TurnkeyBaseGraphQLFeatureOptions,
  TurnkeyBaseGraphQLModuleAsyncOptions,
  TurnkeyBaseGraphQLModuleOptions,
  TurnkeyRouteAccess,
} from './turnkey-graphql.options';

const mergeAccess = (flat: TurnkeyRouteAccess, access: TurnkeyRouteAccess | undefined): TurnkeyRouteAccess => ({
  decorateRoute: access?.decorateRoute ?? flat.decorateRoute,
  canAccessCompany: access?.canAccessCompany ?? flat.canAccessCompany,
  allowAllCompanies: access?.allowAllCompanies ?? flat.allowAllCompanies,
});

/** TurnkeyJSON scalar 必須是 provider，Nest GraphQL 才會掃描註冊 */
const createResolvers = (access: TurnkeyRouteAccess): Type<unknown>[] => {
  if (!access.decorateRoute) {
    // 統編檢查之外沒有任何動作層級的授權：通過 canAccessCompany 的呼叫者可以開立、作廢、註銷
    new Logger('TurnkeyBaseGraphQLModule').warn(
      'decorateRoute is not set: every caller allowed for a company can use every query and mutation. ' +
        'Use memberBaseAccess() or your own decorateRoute to check permissions per action.',
    );
  }

  return [TurnkeyJSONScalar, createTurnkeyQueryResolver(access), createTurnkeyMutationResolver(access)];
};

@Module({})
export class TurnkeyBaseGraphQLModule {
  /** 帶著 Core 一起註冊；整個 app 只能有一個 forRoot（REST 或 GraphQL 其中一個），另一個改用 forFeature */
  static forRoot(options: TurnkeyBaseGraphQLModuleOptions): DynamicModule {
    const { decorateRoute, canAccessCompany, allowAllCompanies, access, ...baseOptions } = options;

    return {
      module: TurnkeyBaseGraphQLModule,
      imports: [TurnkeyBaseModule.forRoot(baseOptions)],
      providers: createResolvers(mergeAccess({ decorateRoute, canAccessCompany, allowAllCompanies }, access)),
    };
  }

  /** Core 的設定由 useFactory／useClass／useExisting 提供；access 必須在頂層（resolver 的 decorator 在定義時套上） */
  static forRootAsync(options: TurnkeyBaseGraphQLModuleAsyncOptions): DynamicModule {
    const { access, ...baseAsyncOptions } = options;

    return {
      module: TurnkeyBaseGraphQLModule,
      imports: [TurnkeyBaseModule.forRootAsync(baseAsyncOptions)],
      providers: createResolvers(access ?? {}),
    };
  }

  /** Core 已由別處註冊（例如 REST 模組的 forRoot），這裡只掛 resolver */
  static forFeature(options: TurnkeyBaseGraphQLFeatureOptions = {}): DynamicModule {
    const { access, ...flat } = options;

    return {
      module: TurnkeyBaseGraphQLModule,
      providers: createResolvers(mergeAccess(flat, access)),
    };
  }
}
