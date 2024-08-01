import { CustomDecorator, SetMetadata } from '@nestjs/common';

export const IS_ROUTE_ONLY_AUTHENTICATED = 'IS_ROUTE_ONLY_AUTHENTICATED';

export const Authenticated = (): CustomDecorator<string> =>
  SetMetadata(IS_ROUTE_ONLY_AUTHENTICATED, true);
