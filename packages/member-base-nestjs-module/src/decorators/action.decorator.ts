import { Reflector } from '@nestjs/core';

export type Subject = string;
export type Action = string;

export const AllowActions = Reflector.createDecorator<[Subject, Action][]>();
