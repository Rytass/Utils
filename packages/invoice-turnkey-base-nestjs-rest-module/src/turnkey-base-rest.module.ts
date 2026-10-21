import { DynamicModule, Module } from '@nestjs/common';
import { TurnkeyBaseModule } from '@rytass/invoice-turnkey-base-nestjs-module';
import { createTurnkeyController } from './turnkey.controller';
import {
  resolveRoutePrefix,
  TurnkeyBaseRestFeatureOptions,
  TurnkeyBaseRestModuleAsyncOptions,
  TurnkeyBaseRestModuleOptions,
  TurnkeyRouteAccess,
} from './turnkey-rest.options';

const mergeAccess = (flat: TurnkeyRouteAccess, access: TurnkeyRouteAccess | undefined): TurnkeyRouteAccess => ({
  decorateRoute: access?.decorateRoute ?? flat.decorateRoute,
  canAccessCompany: access?.canAccessCompany ?? flat.canAccessCompany,
  allowAllCompanies: access?.allowAllCompanies ?? flat.allowAllCompanies,
});

@Module({})
export class TurnkeyBaseRestModule {
  /** 帶著 Core 一起註冊；整個 app 只能有一個 forRoot（REST 或 GraphQL 其中一個） */
  static forRoot(options: TurnkeyBaseRestModuleOptions): DynamicModule {
    const { routePrefix, access, decorateRoute, canAccessCompany, allowAllCompanies, ...baseOptions } = options;

    return {
      module: TurnkeyBaseRestModule,
      imports: [TurnkeyBaseModule.forRoot(baseOptions)],
      controllers: [
        createTurnkeyController(
          resolveRoutePrefix(routePrefix),
          mergeAccess({ decorateRoute, canAccessCompany, allowAllCompanies }, access),
        ),
      ],
    };
  }

  /** Core 的設定由 useFactory／useClass／useExisting 提供；routePrefix 與 access 必須在頂層 */
  static forRootAsync(options: TurnkeyBaseRestModuleAsyncOptions): DynamicModule {
    const { routePrefix, access, ...baseAsyncOptions } = options;

    return {
      module: TurnkeyBaseRestModule,
      imports: [TurnkeyBaseModule.forRootAsync(baseAsyncOptions)],
      controllers: [createTurnkeyController(resolveRoutePrefix(routePrefix), access ?? {})],
    };
  }

  /** Core 已由別處註冊（例如 GraphQL 模組的 forRoot），這裡只掛 controller */
  static forFeature(options: TurnkeyBaseRestFeatureOptions = {}): DynamicModule {
    const { routePrefix, access, ...flat } = options;

    return {
      module: TurnkeyBaseRestModule,
      controllers: [createTurnkeyController(resolveRoutePrefix(routePrefix), mergeAccess(flat, access))],
    };
  }
}
