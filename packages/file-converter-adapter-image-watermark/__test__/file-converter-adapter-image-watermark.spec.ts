import { ImageWatermark } from '../src/image-watermark';
import { createHash } from 'crypto';
import { createReadStream, readFileSync } from 'fs';
import { resolve } from 'path';
import { Readable } from 'stream';
import sharp, { gravity } from 'sharp';

describe('Image Transcoder Watermark', () => {
  const watermarkBuffer = readFileSync(
    resolve(__dirname, '../__fixtures__/watermark.png'),
  );

  it('should add watermark to buffer', async () => {
    const sourceBuffer = readFileSync(
      resolve(__dirname, '../__fixtures__/test-image.png'),
    );

    const transcoder = new ImageWatermark({
      watermarks: [{ image: watermarkBuffer }],
    });

    const buffer = await transcoder.convert<Buffer>(sourceBuffer);

    const resultHash = createHash('sha256')
      .update(
        await sharp(sourceBuffer)
          .composite([
            {
              input: watermarkBuffer,
              gravity: gravity.southeast,
            },
          ])
          .toBuffer(),
      )
      .digest('hex');

    expect(createHash('sha256').update(buffer).digest('hex')).toBe(resultHash);
  });

  it('should add watermark to stream', async () => {
    const sourceBuffer = readFileSync(
      resolve(__dirname, '../__fixtures__/test-image.png'),
    );

    const readStream = createReadStream(
      resolve(__dirname, '../__fixtures__/test-image.png'),
    );

    const transcoder = new ImageWatermark({
      watermarks: [{ image: watermarkBuffer }],
    });

    const resultHash = createHash('sha256')
      .update(
        await sharp(sourceBuffer)
          .composite([
            {
              input: watermarkBuffer,
              gravity: gravity.southeast,
            },
          ])
          .toBuffer(),
      )
      .digest('hex');

    const stream = await transcoder.convert<Readable>(readStream);

    const hash = createHash('sha256');

    return new Promise<void>((pResolve) => {
      stream.on('data', (chunk) => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        expect(hash.digest('hex')).toBe(resultHash);

        pResolve();
      });
    });
  });
});
