import { ExecutionContext } from '@nestjs/common';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { Request } from 'express';
import type { Enforcer } from 'casbin';
import type { AuthTokenPayloadBase } from '../typings/auth-token-payload';
import type {
  CasbinAuthorizationDecision,
  CasbinPermissionCheckerParams,
  CasbinPermissionCheckerResult,
  CasbinPermissionCheckerSyncResult,
} from '../typings/casbin-permission';

type InjectedRequest = Request & {
  enforcer?: Enforcer | null;
  payload?: AuthTokenPayloadBase;
  casbinPermissionChecker?: (
    options: CasbinPermissionCheckerParams,
  ) => CasbinPermissionCheckerResult | CasbinPermissionCheckerSyncResult;
  casbinDecision?: CasbinAuthorizationDecision;
};

interface GraphQLModule {
  GqlExecutionContext: {
    create: (context: ExecutionContext) => {
      getContext: () => { req: InjectedRequest };
    };
  };
}

let graphqlModule: GraphQLModule | null = null;

/**
 * Load `@nestjs/graphql` on the first GraphQL request.
 *
 * It is an optional peer, so it cannot be a static import: an application that
 * never serves GraphQL must not be made to install it. It cannot be a dynamic
 * `import()` either, because three parameter decorators call
 * getRequestFromContext synchronously and Nest resolves their value inline.
 * That leaves a synchronous require.
 *
 * The CommonJS build has one. The ES module build does not, and a bare
 * `require()` there is a ReferenceError that takes down the whole entry point —
 * so it falls back to `createRequire`, anchored on the application root, which
 * is where a peer dependency lives anyway. `typeof` on an undeclared binding is
 * safe in both, and `import.meta.url` is deliberately not used: it cannot be
 * parsed by a CommonJS test runner.
 *
 * Cached, because a guard runs on every request.
 */
const loadGraphQLModule = (): GraphQLModule => {
  if (graphqlModule) return graphqlModule;

  const load = typeof require === 'function' ? require : createRequire(join(process.cwd(), 'package.json'));

  graphqlModule = load('@nestjs/graphql') as GraphQLModule;

  return graphqlModule;
};

export const getRequestFromContext = (context: ExecutionContext): InjectedRequest => {
  const contextType = context.getType<'http' | 'graphql'>();

  switch (contextType) {
    case 'graphql': {
      const { GqlExecutionContext } = loadGraphQLModule();

      return GqlExecutionContext.create(context).getContext().req;
    }

    case 'http':
    default:
      return context.switchToHttp().getRequest<InjectedRequest>();
  }
};
