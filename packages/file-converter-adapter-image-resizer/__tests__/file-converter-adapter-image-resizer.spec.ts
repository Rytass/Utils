import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { Readable, PassThrough } from 'stream';

// Mock sharp since vips/sharp compatibility issues in test environment
jest.mock('sharp', () => {
  const { PassThrough } = require('stream');

  // Create a mock that extends PassThrough properly
  class MockSharpStream extends PassThrough {
    resize = jest.fn().mockReturnThis();
    toBuffer = jest.fn().mockResolvedValue(Buffer.from('mocked-resized-image'));
    metadata = jest.fn().mockResolvedValue({ width: 50, height: 50 });
  }

  const mockSharp = jest.fn().mockImplementation(() => new MockSharpStream());

  mockSharp.cache = jest.fn();
  mockSharp.concurrency = jest.fn();

  return { default: mockSharp, __esModule: true };
});

describe('Image Transcoder Resizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw if no target size provided', () => {
    expect(() => new ImageResizer()).toThrow('Please provide at least one `maxWidth` or `maxHeight`');
  });

  it('should allow only maxWidth', () => {
    expect(() => new ImageResizer({ maxWidth: 100 })).not.toThrow();
  });

  it('should allow only maxHeight', () => {
    expect(() => new ImageResizer({ maxHeight: 100 })).not.toThrow();
  });

  it('should resize from stream to stream', async () => {
    const readStream = new PassThrough();

    readStream.end(Buffer.from('test-image-data'));

    const transcoder = new ImageResizer({
      maxWidth: 50,
      maxHeight: 50,
    });

    const stream = await transcoder.convert<Readable>(readStream);

    expect(stream).toBeInstanceOf(Readable);
  });

  it('should resize buffer to buffer', async () => {
    const sourceBuffer = Buffer.from('test-image-data');

    const transcoder = new ImageResizer({
      maxWidth: 50,
      maxHeight: 50,
    });

    const buffer = await transcoder.convert<Buffer>(sourceBuffer);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.toString()).toBe('mocked-resized-image');
  });

  it('should use cover fit when keepAspectRatio is not explicitly set', async () => {
    // When keepAspectRatio is not passed, it defaults to undefined (falsy),
    // which results in 'cover' fit mode
    const sourceBuffer = Buffer.from('test-image-data');

    const transcoder = new ImageResizer({
      maxWidth: 70,
      maxHeight: 90,
    });

    await transcoder.convert<Buffer>(sourceBuffer);

    // Verify sharp was called correctly - constructor is called with the buffer
    const sharp = jest.requireMock('sharp').default;

    expect(sharp).toHaveBeenCalledWith(sourceBuffer);

    // Verify resize was called with correct options on the instance
    const sharpInstance = sharp.mock.results[0].value;

    expect(sharpInstance.resize).toHaveBeenCalled();
    // Check the call arguments - without explicit keepAspectRatio, fit is 'cover'
    const resizeCall = sharpInstance.resize.mock.calls[0][0];

    expect(resizeCall).toEqual({
      width: 70,
      height: 90,
      withoutEnlargement: true,
      fit: 'cover',
    });
  });

  it('should resize and keep aspect ratio when explicitly set', async () => {
    const sourceBuffer = Buffer.from('test-image-data');

    const transcoder = new ImageResizer({
      maxWidth: 70,
      maxHeight: 90,
      keepAspectRatio: true,
    });

    await transcoder.convert<Buffer>(sourceBuffer);

    const sharp = jest.requireMock('sharp').default;
    const sharpInstance = sharp.mock.results[0].value;

    expect(sharpInstance.resize).toHaveBeenCalled();
    const resizeCall = sharpInstance.resize.mock.calls[0][0];

    expect(resizeCall).toEqual({
      width: 70,
      height: 90,
      withoutEnlargement: true,
      fit: 'inside',
    });
  });

  it('should resize and do not keep aspect ratio', async () => {
    const sourceBuffer = Buffer.from('test-image-data');

    const transcoder = new ImageResizer({
      maxWidth: 70,
      maxHeight: 90,
      keepAspectRatio: false,
    });

    await transcoder.convert<Buffer>(sourceBuffer);

    const sharp = jest.requireMock('sharp').default;
    const sharpInstance = sharp.mock.results[0].value;

    expect(sharpInstance.resize).toHaveBeenCalled();
    const resizeCall = sharpInstance.resize.mock.calls[0][0];

    expect(resizeCall).toEqual({
      width: 70,
      height: 90,
      withoutEnlargement: true,
      fit: 'cover',
    });
  });

  it('should set concurrency when provided', () => {
    const sharp = jest.requireMock('sharp').default;

    new ImageResizer({
      maxWidth: 50,
      concurrency: 4,
    });

    expect(sharp.concurrency).toHaveBeenCalledWith(4);
  });

  it('should default concurrency to 1', () => {
    const sharp = jest.requireMock('sharp').default;

    new ImageResizer({
      maxWidth: 50,
    });

    expect(sharp.concurrency).toHaveBeenCalledWith(1);
  });
});
