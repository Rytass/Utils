import { ConvertableFile, FileConverter } from '@rytass/file-converter';
import sharp, { gravity } from 'sharp';
import { Readable } from 'stream';
import { ImageWatermarkOptions } from './typings';

sharp.cache(false);

export class ImageWatermark implements FileConverter<ImageWatermarkOptions> {
  private readonly options: ImageWatermarkOptions;

  constructor(options: ImageWatermarkOptions) {
    this.options = options;

    sharp.concurrency(options.concurrency ?? 1);
  }

  async convert<Output extends ConvertableFile>(file: ConvertableFile): Promise<Output> {
    let converter;

    if (file instanceof Buffer) {
      converter = sharp(file);
    } else {
      converter = sharp();
    }

    converter.composite(
      this.options.watermarks.map(watermark => ({
        input: watermark.image,
        gravity: watermark.gravity || gravity.southeast,
      })),
    );

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
