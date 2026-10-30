import type { ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from './get-request-from-context';

interface OperationInfo {
  operation?: { operation?: string };
}

/**
 * The object that identifies one unit of work, for results that may be reused
 * inside it — or `null` when nothing may be reused.
 *
 * Over HTTP that is the request. Over GraphQL it is the operation's context
 * value rather than `context.req`: a batched HTTP request carries several
 * operations on one `req`, and a mutation in the first must not decide what the
 * second sees. A subscription is never a scope. Its context lives as long as
 * the connection, so anything cached there would outlive a revoked role or an
 * expired token by hours. Neither is a websocket gateway or a microservice
 * context, for the same reason.
 *
 * Read through `getArgByIndex` instead of GqlExecutionContext so that nothing
 * here needs the optional `@nestjs/graphql` peer: resolver arguments are
 * `(root, args, context, info)`, whatever the driver.
 */
export const getAuthScope = (context?: ExecutionContext): object | null => {
  if (!context) return null;

  const contextType = context.getType<'http' | 'graphql' | 'ws' | 'rpc'>();

  if (contextType === 'graphql') {
    const info = context.getArgByIndex<OperationInfo | undefined>(3);

    if (info?.operation?.operation === 'subscription') return null;

    const operationContext = context.getArgByIndex<unknown>(2);

    return typeof operationContext === 'object' && operationContext !== null ? operationContext : null;
  }

  // A websocket gateway or a microservice hands over a socket or a message
  // channel, not a request — both live longer than one call.
  if (contextType !== 'http') return null;

  // The same request the guard writes to — getRequestFromContext is the one
  // place that decides which object that is.
  const request: unknown = getRequestFromContext(context);

  return typeof request === 'object' && request !== null ? request : null;
};
