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

const GRAPHQL_PACKAGE = '@nestjs/graphql';

/**
 * Load `@nestjs/graphql` on the first GraphQL request.
 *
 * It is an optional peer, so it cannot be a static import: an application that
 * never serves GraphQL must not be made to install it. It cannot be a dynamic
 * `import()` either, because three parameter decorators call
 * getRequestFromContext synchronously and Nest resolves their value inline.
 * That leaves a synchronous require.
 *
 * The CommonJS build has one and resolves relative to itself. The ES module
 * build does not — a bare `require()` there is a ReferenceError that takes down
 * the whole entry point — so it has to give `createRequire` an anchor, and the
 * anchor decides where the lookup starts.
 *
 * The entry script is tried first because it sits inside the application tree
 * whatever directory the process was started from. The working directory is
 * only a fallback: anchoring on it alone made this fail on the first GraphQL
 * request of any application launched from somewhere other than its own root.
 *
 * `import.meta.url` would be the natural anchor and is deliberately not used:
 * it cannot be parsed by a CommonJS test runner, and this source is compiled
 * for both.
 *
 * Cached, because a guard runs on every request.
 */
const loadGraphQLModule = (): GraphQLModule => {
  if (graphqlModule) return graphqlModule;

  if (typeof require === 'function') {
    graphqlModule = require(GRAPHQL_PACKAGE) as GraphQLModule;

    return graphqlModule;
  }

  const anchors = [process.argv[1], join(process.cwd(), 'package.json')].filter(
    (anchor): anchor is string => typeof anchor === 'string' && anchor !== '',
  );

  for (const anchor of anchors) {
    const resolveFrom = createRequire(anchor);
    let resolved: string;

    // Locating and loading are kept separate on purpose. A failure to locate is
    // the only thing another anchor can fix, and inspecting the error to tell
    // the two apart does not work: Node embeds a "Require stack" naming the file
    // that did the requiring, so a package that is installed but throws
    // MODULE_NOT_FOUND for one of its own dependencies produces a message
    // containing this package's name, and would be misreported as absent.
    try {
      resolved = resolveFrom.resolve(GRAPHQL_PACKAGE);
    } catch {
      continue;
    }

    // Anything thrown from here belongs to the package itself and is the answer.
    graphqlModule = resolveFrom(resolved) as GraphQLModule;

    return graphqlModule;
  }

  throw new Error(
    `${GRAPHQL_PACKAGE} could not be resolved from ${anchors.join(' or ')}. ` +
      'It is an optional peer dependency and must be installed by the application that serves GraphQL.',
  );
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
