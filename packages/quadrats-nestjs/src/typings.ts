import { ModuleMetadata, InjectionToken, OptionalFactoryDependency } from '@nestjs/common';

export interface QuadratsModuleOptions {
  host?: string;
  accessKey: string;
  secret: string;
}

export interface QuadratsModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  name?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory: (...args: any[]) => Promise<QuadratsModuleOptions> | QuadratsModuleOptions;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}
