import { ImageWatermark } from '../src/image-watermark';
import sharp from 'sharp';
import { createHash } from 'crypto';
import { createReadStream, writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Readable } from 'stream';

describe('Image Transcoder Watermark', () => {
  const watermarkBuffer = readFileSync(resolve(__dirname, '../__fixtures__/watermark.png'));
  const resultHash = createHash('sha256').update(readFileSync(resolve(__dirname, '../__fixtures__/result-sample.png'))).digest('hex');

  it('should add watermark to buffer', async () => {
    const sourceBuffer = readFileSync(resolve(__dirname, '../__fixtures__/test-image.png'));

    const transcoder = new ImageWatermark({
      watermarks: [
        { image: watermarkBuffer },
      ],
    });

    const buffer = await transcoder.convert<Buffer>(sourceBuffer);

    expect(createHash('sha256').update(buffer).digest('hex')).toBe(resultHash);
  });

  it('should add watermark to stream', async () => {
    const readStream = createReadStream(resolve(__dirname, '../__fixtures__/test-image.png'));

    const transcoder = new ImageWatermark({
      watermarks: [
        { image: watermarkBuffer },
      ],
    });

    const stream = await transcoder.convert<Readable>(readStream);

    const hasher = createHash('sha256');

    return new Promise<void>((pResolve) => {
      stream.on('data', (chunk) => {
        hasher.update(chunk);
      })

      stream.on('end', () => {
        expect(hasher.digest('hex')).toBe(resultHash);

        pResolve();
      });
    });
  });
});
