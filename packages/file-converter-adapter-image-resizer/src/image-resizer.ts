import { ConvertableFile, FileConverter } from '@rytass/file-converter';
import sharp from 'sharp';
import { Readable } from 'stream';
import { ImageResizerOptions } from './typings';

export class ImageResizer implements FileConverter<ImageResizerOptions> {
  private readonly options: ImageResizerOptions;

  constructor(options: ImageResizerOptions = {
    keepAspectRatio: true,
  }) {
    if (!options.maxHeight && !options.maxWidth) throw new Error('Please provide at least one `maxWidth` or `maxHeight`');

    this.options = options;
  }

  async convert<Output extends ConvertableFile>(file: ConvertableFile): Promise<Output> {
    let converter;

    if (file instanceof Buffer) {
      converter = sharp(file);
    } else {
      converter = sharp();
    }

    converter.resize({
      width: this.options.maxWidth,
      height: this.options.maxHeight,
      withoutEnlargement: true,
      fit: this.options.keepAspectRatio ? 'inside' : 'cover',
    });

    // Stream cannot throw when format not supported
    if (file instanceof Readable) {
      file.pipe(converter);
    }

    if (file instanceof Buffer) {
      return converter.toBuffer() as Promise<Output>;
    }

    return converter as Readable as Output;
  }
}
