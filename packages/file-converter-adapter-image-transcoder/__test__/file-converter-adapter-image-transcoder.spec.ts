import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';
import sharp from 'sharp';
import { createReadStream, readFileSync } from 'fs';
import { resolve } from 'path';
import { Readable } from 'stream';

describe('Image Transcoder Converter', () => {
  it('should convert png to jpeg from stream to stream', (done) => {
    const readStream = createReadStream(resolve(__dirname, '../__fixtures__/test-image.png'));

    const transcoder = new ImageTranscoder({
      targetFormat: 'jpeg',
    });

    transcoder.convert<Readable>(readStream).then(async (stream) => {
      const resolver = sharp();

      stream.pipe(resolver);

      const metadata = await resolver.metadata();

      expect(metadata.format).toBe('jpeg');

      done();
    });
  });

  it('should convert png to webp from buffer to buffer', (done) => {
    const sourceBuffer = readFileSync(resolve(__dirname, '../__fixtures__/test-image.png'));

    const transcoder = new ImageTranscoder({
      targetFormat: 'webp',
    });

    transcoder.convert<Buffer>(sourceBuffer).then(async (buffer) => {
      const metadata = await sharp(buffer).metadata();

      expect(metadata.format).toBe('webp');

      done();
    });
  });
});
