import { ErrorCallback, FileStats, StorageOptions } from '..';

export interface Converter<
  T extends string = any,
  K extends string = any,
  O extends Partial<{ [key: string]: any }> = any
> {
  from: T[];
  to: K[];
  load: (
    extension: T,
    buffer: Buffer,
    options?: O
  ) => Buffer | Promise<Buffer>;
}

export interface ConverterManagerInterface<T extends Converter[]> {
  convert: (
    extension: Convertable<T>['extension'],
    stats: FileStats,
    options?: Convertable<T>['options']
  ) => Buffer | Promise<Buffer> | undefined | Promise<undefined>;
}

export interface ConverterArguments<
  T extends string,
  K extends Partial<{ [key: string]: any }>
> {
  extension: T;
  options?: K;
}

export type Convertable<T> = T extends Converter[]
  ? ConverterArguments<
      Parameters<T[number]['load']>[0],
      Parameters<T[number]['load']>[2]
    >
  : T extends StorageOptions
  ? Convertable<T['converters']>
  : never;
