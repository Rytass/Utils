import { ModuleMetadata, InjectionToken, OptionalFactoryDependency } from '@nestjs/common';

export interface QuadratsModuleOptions {
  host?: string;
  accessKey: string;
  secret: string;
}

export interface QuadratsModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  name?: string;
  useFactory: (...args: unknown[]) => Promise<QuadratsModuleOptions> | QuadratsModuleOptions;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}
