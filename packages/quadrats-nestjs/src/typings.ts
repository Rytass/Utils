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
  extraProviders?: Provider[]; // waiting for some one to use this
  useClass?: Type<QuadratsModuleOptions>; // waiting for some one to use this
  useExisting?: Type<QuadratsModuleOptions>; // waiting for some one to use this
}