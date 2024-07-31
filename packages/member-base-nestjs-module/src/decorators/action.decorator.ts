import { Reflector } from '@nestjs/core';

export type Domain = string;
export type Subject = string;
export type Action = string;

export const AllowActions =
  Reflector.createDecorator<[Domain, Subject, Action][]>();
