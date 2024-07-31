import { Reflector } from '@nestjs/core';

export const AllowActions = Reflector.createDecorator<string[]>();
