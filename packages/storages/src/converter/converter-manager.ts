import {
  Convertable,
  Converter,
  ConverterManagerInterface,
  ErrorCode,
  FileStats,
  StorageError,
} from '..';

export class ConverterManager<T extends Converter[]>
  implements ConverterManagerInterface<T>
{
  private readonly converters: Converter[];

  constructor(converters: T extends Converter[] ? T : never) {
    this.converters = converters;
  }
  convert(extension: Convertable<T>, stats: FileStats, options: Convertable<T>['options']) {
    const [converter] = this.converters.filter(
      converter =>
        converter.from.includes(stats.extension) &&
        converter.to.includes(extension)
    );

    if (converter) return converter.load(extension, stats.buffer, options);

    throw new StorageError(
      ErrorCode.UNRECOGNIZED_ERROR,
      `Undefined convert attempt: ${stats.extension} to ${extension}`
    );
  }
}
