import type { ConvertableFile, FileConverter } from './file-converter';

export class ConverterManager {
  private readonly converters: FileConverter[];

  constructor(converters: FileConverter[]) {
    this.converters = converters;
  }

  convert<ConvertableFileFormat extends ConvertableFile>(file: ConvertableFile): Promise<ConvertableFileFormat> {
    return this.converters
      .map(converter => (previousFile: ConvertableFile) =>
        converter.convert<ConvertableFileFormat>(previousFile)
      )
      .reduce<Promise<ConvertableFileFormat>>((prev, next) => prev.then(next), Promise.resolve(file as ConvertableFileFormat));
  }
}
