import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import sharp from 'sharp';
import { createReadStream, readFileSync } from 'fs';
import { resolve } from 'path';
import { Readable } from 'stream';

describe('Image Transcoder Resizer', () => {
  it('should throw if no target size provided', () => {
    expect(() => new ImageResizer()).toThrow();
  });

  it('should resize from stream to stream', async () => {
    const readStream = createReadStream(resolve(__dirname, '../__fixtures__/test-image.png'));

    const transcoder = new ImageResizer({
      maxWidth: 50,
      maxHeight: 50,
    });

    const stream = await transcoder.convert<Readable>(readStream);

    const resolver = sharp();

    stream.pipe(resolver);

    const metadata = await resolver.metadata();

    expect(metadata.width).toBe(50);
    expect(metadata.height).toBe(50);
  });

  it('should resize buffer to buffer', async () => {
    const sourceBuffer = readFileSync(resolve(__dirname, '../__fixtures__/test-image.png'));

    const transcoder = new ImageResizer({
      maxWidth: 50,
      maxHeight: 50,
    });

    const buffer = await transcoder.convert<Buffer>(sourceBuffer);

    const metadata = await sharp(buffer).metadata();

    expect(metadata.width).toBe(50);
    expect(metadata.height).toBe(50);
  });

  it('should resize and keep aspect ratio', async () => {
    const sourceBuffer = readFileSync(resolve(__dirname, '../__fixtures__/test-image.png'));

    const transcoder = new ImageResizer({
      maxWidth: 70,
      maxHeight: 90,
      keepAspectRatio: true,
    });

    const buffer = await transcoder.convert<Buffer>(sourceBuffer);

    const metadata = await sharp(buffer).metadata();

    expect(metadata.width).toBe(70);
    expect(metadata.height).toBe(70);
  });

  it('should resize and do not keep aspect ratio', async () => {
    const sourceBuffer = readFileSync(resolve(__dirname, '../__fixtures__/test-image.png'));

    const transcoder = new ImageResizer({
      maxWidth: 70,
      maxHeight: 90,
      keepAspectRatio: false,
    });

    const buffer = await transcoder.convert<Buffer>(sourceBuffer);

    const metadata = await sharp(buffer).metadata();

    expect(metadata.width).toBe(70);
    expect(metadata.height).toBe(90);
  });
});
