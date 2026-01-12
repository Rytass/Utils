import { ImageWatermark } from '../src/image-watermark';
import { Readable, PassThrough } from 'stream';

// Mock sharp since vips/sharp compatibility issues in test environment
jest.mock('sharp', () => {
  const { PassThrough } = require('stream');

  // Create a mock that extends PassThrough properly
  class MockSharpStream extends PassThrough {
    composite = jest.fn().mockReturnThis();
    toBuffer = jest.fn().mockResolvedValue(Buffer.from('mocked-watermarked-image'));
  }

  const mockSharp = jest.fn().mockImplementation(() => new MockSharpStream());

  mockSharp.cache = jest.fn();
  mockSharp.concurrency = jest.fn();

  return {
    default: mockSharp,
    __esModule: true,
    gravity: {
      southeast: 'southeast',
      northwest: 'northwest',
      center: 'center',
      north: 'north',
      south: 'south',
      east: 'east',
      west: 'west',
    },
  };
});

describe('Image Transcoder Watermark', () => {
  const watermarkBuffer = Buffer.from('watermark-image-data');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should add watermark to buffer', async () => {
    const sourceBuffer = Buffer.from('test-source-image-data');

    const transcoder = new ImageWatermark({
      watermarks: [{ image: watermarkBuffer }],
    });

    const buffer = await transcoder.convert<Buffer>(sourceBuffer);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.toString()).toBe('mocked-watermarked-image');

    // Verify sharp was called with correct composite options
    const sharp = jest.requireMock('sharp').default;
    const sharpInstance = sharp.mock.results[0].value;

    expect(sharpInstance.composite).toHaveBeenCalledWith([
      {
        input: watermarkBuffer,
        gravity: 'southeast',
      },
    ]);
  });

  it('should add watermark to stream', async () => {
    const readStream = new PassThrough();

    readStream.end(Buffer.from('test-source-image-data'));

    const transcoder = new ImageWatermark({
      watermarks: [{ image: watermarkBuffer }],
    });

    const stream = await transcoder.convert<Readable>(readStream);

    expect(stream).toBeInstanceOf(Readable);
  });

  it('should add multiple watermarks', async () => {
    const sourceBuffer = Buffer.from('test-source-image-data');
    const watermarkBuffer2 = Buffer.from('watermark-2-image-data');

    const transcoder = new ImageWatermark({
      watermarks: [{ image: watermarkBuffer }, { image: watermarkBuffer2, gravity: 'northwest' }],
    });

    await transcoder.convert<Buffer>(sourceBuffer);

    const sharp = jest.requireMock('sharp').default;
    const sharpInstance = sharp.mock.results[0].value;

    expect(sharpInstance.composite).toHaveBeenCalledWith([
      {
        input: watermarkBuffer,
        gravity: 'southeast',
      },
      {
        input: watermarkBuffer2,
        gravity: 'northwest',
      },
    ]);
  });

  it('should use custom gravity when provided', async () => {
    const sourceBuffer = Buffer.from('test-source-image-data');

    const transcoder = new ImageWatermark({
      watermarks: [{ image: watermarkBuffer, gravity: 'center' }],
    });

    await transcoder.convert<Buffer>(sourceBuffer);

    const sharp = jest.requireMock('sharp').default;
    const sharpInstance = sharp.mock.results[0].value;

    expect(sharpInstance.composite).toHaveBeenCalledWith([
      {
        input: watermarkBuffer,
        gravity: 'center',
      },
    ]);
  });

  it('should set concurrency when provided', () => {
    const sharp = jest.requireMock('sharp').default;

    new ImageWatermark({
      watermarks: [{ image: watermarkBuffer }],
      concurrency: 4,
    });

    expect(sharp.concurrency).toHaveBeenCalledWith(4);
  });

  it('should default concurrency to 1', () => {
    const sharp = jest.requireMock('sharp').default;

    new ImageWatermark({
      watermarks: [{ image: watermarkBuffer }],
    });

    expect(sharp.concurrency).toHaveBeenCalledWith(1);
  });
});
