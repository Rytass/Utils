import { StorageLocalService } from '@rytass/storages-adapter-local';

export interface Converter<T = any, K = any> {
  from?: T;
  to?: K;
  load: (extension: T, buffer: Buffer) => Buffer;
}

export interface ConverterManager<T extends Converter[]> {
  availableExtensions?: T[number]['from'];
  convert: (
    extension: ConverterManager<T>['availableExtensions'],
    buffer: Buffer
  ) => Buffer;
}

export type ConvertableStatus<T> = T extends Converter[]
  ? T[number]['from']
  : never;
