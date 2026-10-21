import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import sharp from 'sharp';
import { PassThrough, Readable } from 'stream';

const createPortraitJpeg = (): Promise<Buffer> =>
  sharp({ create: { width: 3000, height: 2000, channels: 3, background: 'red' } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();

const createAnimatedGif = async (): Promise<Buffer> => {
  const frames = await Promise.all(
    ['red', 'green', 'blue'].map(color =>
      sharp({ create: { width: 200, height: 100, channels: 4, background: color } })
        .raw()
        .toBuffer(),
    ),
  );

  return sharp(Buffer.concat(frames), { raw: { width: 200, height: 300, channels: 4, pageHeight: 100 } })
    .gif({ loop: 0, delay: [100, 100, 100] })
    .toBuffer();
};

const readAll = async (stream: Readable): Promise<Buffer> => {
  const chunks = await stream.toArray();

  return Buffer.concat(chunks);
};

describe('Image Resizer with sharp', () => {
  it('should apply EXIF orientation before resizing', async () => {
    const resizer = new ImageResizer({ maxWidth: 1920, keepAspectRatio: true });

    const output = await resizer.convert<Buffer>(await createPortraitJpeg());
    const metadata = await sharp(output).metadata();

    expect(metadata.width).toBe(1920);
    expect(metadata.height).toBe(2880);
    expect(metadata.orientation).toBeUndefined();
  });

  it('should apply EXIF orientation from stream input', async () => {
    const resizer = new ImageResizer({ maxWidth: 1920, keepAspectRatio: true });

    const output = await resizer.convert<Readable>(Readable.from([await createPortraitJpeg()]));
    const metadata = await sharp(await readAll(output)).metadata();

    expect(metadata.width).toBe(1920);
    expect(metadata.height).toBe(2880);
  });

  it('should keep all frames of animated GIF', async () => {
    const resizer = new ImageResizer({ maxWidth: 100, keepAspectRatio: true });

    const output = await resizer.convert<Buffer>(await createAnimatedGif());
    const metadata = await sharp(output, { animated: true }).metadata();

    expect(metadata.pages).toBe(3);
    expect(metadata.width).toBe(100);
    expect(metadata.pageHeight).toBe(50);
  });

  it('should keep all frames of animated WebP from chunked stream', async () => {
    const webp = await sharp(await createAnimatedGif(), { animated: true })
      .webp()
      .toBuffer();

    const chunks = Array.from({ length: Math.ceil(webp.length / 5) }, (_, index) =>
      webp.subarray(index * 5, index * 5 + 5),
    );

    const resizer = new ImageResizer({ maxWidth: 100, keepAspectRatio: true });

    const output = await resizer.convert<Readable>(Readable.from(chunks));
    const metadata = await sharp(await readAll(output), { animated: true }).metadata();

    expect(metadata.format).toBe('webp');
    expect(metadata.pages).toBe(3);
    expect(metadata.width).toBe(100);
  });

  it('should still resize pyramid TIFF with different page sizes', async () => {
    const tiff = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: 'red' } })
      .tiff({ pyramid: true, tile: true })
      .toBuffer();

    const resizer = new ImageResizer({ maxWidth: 100, keepAspectRatio: true });

    const output = await resizer.convert<Buffer>(tiff);
    const metadata = await sharp(output).metadata();

    expect(metadata.width).toBe(100);
  });

  it('should reject images exceeding limitInputPixels', async () => {
    const resizer = new ImageResizer({ maxWidth: 100, limitInputPixels: 1000 });

    await expect(resizer.convert<Buffer>(await createPortraitJpeg())).rejects.toThrow(/pixel limit/);
  });

  it('should propagate source stream errors to output stream', async () => {
    const source = new PassThrough();
    const resizer = new ImageResizer({ maxWidth: 100 });

    source.write((await createPortraitJpeg()).subarray(0, 100));

    const output = await resizer.convert<Readable>(source);

    setImmediate(() => source.destroy(new Error('boom')));

    await expect(output.toArray()).rejects.toThrow('boom');
  });

  it('should reject output when stream ends before header is complete', async () => {
    const resizer = new ImageResizer({ maxWidth: 100 });

    const output = await resizer.convert<Readable>(Readable.from([Buffer.from('GIF')]));

    await expect(output.toArray()).rejects.toThrow();
  });

  it('should reject output on empty stream', async () => {
    const resizer = new ImageResizer({ maxWidth: 100 });

    const output = await resizer.convert<Readable>(Readable.from([]));

    await expect(output.toArray()).rejects.toThrow();
  });
});
