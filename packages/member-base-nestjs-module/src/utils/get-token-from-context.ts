import { ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const getTokenFromContext = async (
  context: ExecutionContext,
  cookieMode = false,
): Promise<string | null> => {
  const contextType = context.getType<'http' | 'graphql'>();

  switch (contextType) {
    case 'graphql': {
      const { GqlExecutionContext } = await import('@nestjs/graphql');

      const ctx = GqlExecutionContext.create(context).getContext<{
        req: Request;
      }>();

      return (
        (cookieMode
          ? ctx.req.cookies.token
          : (ctx.req.headers.authorization ?? '')
              .replace(/^Bearer\s/, '')
              .trim()) ?? null
      );
    }

    case 'http':
    default:
      return (
        cookieMode
          ? context.switchToHttp().getRequest().cookies.token
          : (context.switchToHttp().getRequest().headers.authorization ?? '')
      )
        .replace(/^Bearer\s/, '')
        .trim();
  }
};
