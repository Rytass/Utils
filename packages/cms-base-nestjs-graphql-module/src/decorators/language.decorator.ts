import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DEFAULT_LANGUAGE } from '@rytass/cms-base-nestjs-module';
import { Request } from 'express';

export const LANGUAGE_HEADER_KEY = 'x-language';

export const Language = createParamDecorator(async (_data: unknown, context: ExecutionContext): Promise<string> => {
  const contextType = context.getType<'http' | 'graphql'>();

  switch (contextType) {
    case 'graphql': {
      const { GqlExecutionContext } = await import('@nestjs/graphql');

      const ctx = GqlExecutionContext.create(context).getContext<{
        req: Request;
      }>();

      const headers = ctx.req.headers;
      const requestLanguage = headers[LANGUAGE_HEADER_KEY];

      if (typeof requestLanguage === 'string') return requestLanguage;

      const acceptLanguage = headers['accept-language'] ?? '';

      if (!acceptLanguage || typeof acceptLanguage !== 'string') return DEFAULT_LANGUAGE;

      return acceptLanguage.split(',')[0].split(';')[0].trim();
    }

    case 'http':
    default: {
      const headers = (context.switchToHttp().getRequest() as Request).headers;

      const requestLanguage = headers[LANGUAGE_HEADER_KEY];

      if (typeof requestLanguage === 'string') return requestLanguage;

      const acceptLanguage = headers['accept-language'] ?? '';

      if (!acceptLanguage || typeof acceptLanguage !== 'string') return DEFAULT_LANGUAGE;

      return acceptLanguage.split(',')[0].split(';')[0].trim();
    }
  }
});
