import { ModuleMetadata, Provider, Type } from '@nestjs/common';

export interface QuadratsModuleOptions {
  host?: string;
  accessKey: string;
  secret: string;
}

export interface QuadratsModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  name?: string;
  useFactory: (...args: any[]) => Promise<QuadratsModuleOptions> | QuadratsModuleOptions;
  inject?: any[];
}