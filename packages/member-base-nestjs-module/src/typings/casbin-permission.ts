import type { ExecutionContext } from '@nestjs/common';
import type { Enforcer } from 'casbin';
import type { AuthTokenPayloadBase } from './auth-token-payload';

export type CasbinPermissionCheckerParams<
  TokenPayload extends {
    id: string;
    account?: string;
    domain?: string;
  } = AuthTokenPayloadBase,
> = {
  enforcer: Enforcer;
  payload: TokenPayload;
  actions: [string, string][];
  context?: ExecutionContext; // original Nest ExecutionContext of the guarded call
  request?: unknown; // result of getRequestFromContext (GraphQL args reachable via context)
};

export type CasbinAuthorizationDecision = {
  allowed: boolean;
  matchedDomain?: string;
  matchedAction?: [string, string];
  meta?: Record<string, unknown>;
};

export type CasbinPermissionCheckerSyncResult = boolean | CasbinAuthorizationDecision;

export type CasbinPermissionCheckerResult = Promise<CasbinPermissionCheckerSyncResult>;

export type CasbinPermissionChecker<
  TokenPayload extends {
    id: string;
    account?: string;
    domain?: string;
  } = AuthTokenPayloadBase,
> = (params: CasbinPermissionCheckerParams<TokenPayload>) => CasbinPermissionCheckerResult;

export type CasbinDomainResolverParams<
  TokenPayload extends {
    id: string;
    account?: string;
    domain?: string;
  } = AuthTokenPayloadBase,
> = {
  context?: ExecutionContext;
  request?: unknown;
  payload: TokenPayload;
  actions: [string, string][];
};

export type CasbinDomainResolver<
  TokenPayload extends {
    id: string;
    account?: string;
    domain?: string;
  } = AuthTokenPayloadBase,
> = (params: CasbinDomainResolverParams<TokenPayload>) => string | string[] | Promise<string | string[]>;
