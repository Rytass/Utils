import { CustomDecorator, SetMetadata } from '@nestjs/common';

export const IS_ROUTE_PUBLIC = 'IS_ROUTE_PUBLIC';

export const IsPublic = (): CustomDecorator<string> =>
  SetMetadata(IS_ROUTE_PUBLIC, true);
