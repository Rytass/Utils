import { FileStats, StorageOptions } from '..';

export interface Converter<T extends string = any, K extends string = any> {
  from: T[]
  to: K[]
  load: (extension: T, buffer: Buffer) => Buffer | Promise<Buffer>;
}

export interface ConverterManagerInterface<T extends Converter[]> {
  convert: (
    extension: Convertable<T>,
    stats: FileStats
  ) => Buffer | Promise<Buffer> | undefined | Promise<undefined>;
}

export type Convertable<T> = T extends Converter[]
  ? T[number]['to'][number]
  : T extends StorageOptions ? Convertable<T['converters']> : never