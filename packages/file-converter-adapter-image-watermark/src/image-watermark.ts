import { ConvertableFile, FileConverter } from '@rytass/file-converter';
// `sharp` is CommonJS and cjs-module-lexer cannot see through its exports, so
// an ESM consumer gets no named bindings — only the default import survives.
import sharp from 'sharp';
import { Readable } from 'stream';
import { ImageWatermarkOptions } from './typings';

const { gravity } = sharp;

sharp.cache(false);

export class ImageWatermark implements FileConverter<ImageWatermarkOptions> {
  private readonly options: ImageWatermarkOptions;

  constructor(options: ImageWatermarkOptions) {
    this.options = options;

    // `sharp.concurrency` is a process-wide libvips setting, only override it when explicitly requested
    if (options.concurrency !== undefined) {
      sharp.concurrency(options.concurrency);
    }
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
