import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const Language = createParamDecorator(
  async (data: unknown, context: ExecutionContext) => {
    const contextType = context.getType<'http' | 'graphql'>();

    let language: string | null;

    switch (contextType) {
      case 'graphql': {
        const { GqlExecutionContext } = await import('@nestjs/graphql');

        const ctx = GqlExecutionContext.create(context).getContext<{
          req: Request;
        }>();

        language = (ctx.req.headers['accept-language'] ?? '').trim();

        break;
      }

      case 'http':
      default:
        language = (
          context.switchToHttp().getRequest().headers['accept-language'] ?? ''
        ).trim();

        break;
    }

    if (!language) {
      return 'zh-tw';
    }

    return language.split(',')[0].split(';')[0].trim().toLowerCase();
  },
);
