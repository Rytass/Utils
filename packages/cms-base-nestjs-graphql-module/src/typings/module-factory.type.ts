import { InjectionToken } from '@nestjs/common';

/**
 * Represents possible dependency injection tokens
 * Used to replace 'any[]' in NestJS module configuration
 */
export type DependencyInjectionToken = InjectionToken | string | symbol | Function;

/**
 * Represents factory function arguments
 * Used to replace 'any[]' in useFactory functions
 */
export type FactoryFunctionArgs = unknown[];
