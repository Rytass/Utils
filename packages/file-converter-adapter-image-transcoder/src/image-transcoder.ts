import { ConvertableFile, FileConverter } from '@rytass/file-converter';
import sharp from 'sharp';
import { Readable } from 'stream';
import { fileTypeFromBuffer } from 'file-type';
import { ImageTranscoderOptions } from './typings';
import { SupportSources } from './constants';
import { UnsupportedSource } from './errors';

sharp.cache(false);

export class ImageTranscoder implements FileConverter<ImageTranscoderOptions> {
  private readonly options: ImageTranscoderOptions;

  constructor(options: ImageTranscoderOptions & { concurrency?: number }) {
    this.options = options;

    sharp.concurrency(options.concurrency ?? 1);
  }

  async convert<Output extends ConvertableFile>(file: ConvertableFile): Promise<Output> {
    let converter;

    if (file instanceof Buffer) {
      const extension = await fileTypeFromBuffer(file);

      if (!extension || !~SupportSources.indexOf(extension.ext)) {
        throw new UnsupportedSource();
      }

      converter = sharp(file);
    } else {
      converter = sharp();
    }

    converter.toFormat(this.options.targetFormat, this.options);

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
