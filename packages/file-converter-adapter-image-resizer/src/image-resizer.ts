import { ConvertableFile, FileConverter } from '@rytass/file-converter';
import sharp, { SharpOptions } from 'sharp';
import { Readable } from 'stream';
import { ImageResizerOptions } from './typings';

sharp.cache(false);

// Enough bytes to recognize GIF (`GIF8`) and WebP (`RIFF....WEBP`) signatures
const HEADER_SIZE = 12;

// Only GIF/WebP are loaded with `animated: true`. Other multi-page formats (e.g. pyramid TIFF)
// may have pages with different sizes, which libvips refuses to load as a single animated image.
const isAnimatableFormat = (header: Buffer): boolean =>
  header.subarray(0, 4).toString('latin1') === 'GIF8' ||
  (header.subarray(0, 4).toString('latin1') === 'RIFF' && header.subarray(8, 12).toString('latin1') === 'WEBP');

const peekStream = async (stream: Readable, size: number): Promise<[Buffer, Readable]> => {
  const iterator: AsyncIterator<Buffer | string> = stream[Symbol.asyncIterator]();

  const readHead = async (head: Buffer): Promise<[Buffer, boolean]> => {
    if (head.length >= size) return [head, false];

    const { value, done } = await iterator.next();

    if (done) return [head, true];

    return readHead(Buffer.concat([head, Buffer.from(value)]));
  };

  const [head, ended] = await readHead(Buffer.alloc(0));

  const rest = async function* (): AsyncGenerator<Buffer> {
    if (head.length) yield head;

    if (ended) return;

    for (let next = await iterator.next(); !next.done; next = await iterator.next()) {
      yield Buffer.from(next.value);
    }
  };

  return [head, Readable.from(rest(), { objectMode: false })];
};

export class ImageResizer implements FileConverter<ImageResizerOptions> {
  private readonly options: ImageResizerOptions;

  constructor(
    options: ImageResizerOptions = {
      keepAspectRatio: true,
      concurrency: 1,
    },
  ) {
    if (!options.maxHeight && !options.maxWidth)
      throw new Error('Please provide at least one `maxWidth` or `maxHeight`');

    this.options = options;

    sharp.concurrency(this.options.concurrency ?? 1);
  }

  private getSharpOptions(header: Buffer): SharpOptions {
    return {
      // Apply EXIF Orientation to pixels so portrait photos stay portrait after resizing
      autoOrient: true,
      animated: isAnimatableFormat(header),
      ...(this.options.limitInputPixels !== undefined ? { limitInputPixels: this.options.limitInputPixels } : {}),
    };
  }

  async convert<Output extends ConvertableFile>(file: ConvertableFile): Promise<Output> {
    let converter;
    let source: Readable | undefined;

    if (file instanceof Readable) {
      const [header, stream] = await peekStream(file, HEADER_SIZE);

      converter = sharp(this.getSharpOptions(header));
      source = stream;
    } else {
      converter = sharp(file, this.getSharpOptions(file));
    }

    converter.resize({
      width: this.options.maxWidth,
      height: this.options.maxHeight,
      withoutEnlargement: true,
      fit: this.options.keepAspectRatio ? 'inside' : 'cover',
    });

    // Stream cannot throw when format not supported
    if (source) {
      // `pipe` does not forward source errors, propagate them to the output stream
      source.on('error', error => converter.destroy(error));
      source.pipe(converter);
    }

    if (file instanceof Buffer) {
      return converter.toBuffer() as Promise<Output>;
    }

    return converter as Readable as Output;
  }
}
