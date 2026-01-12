import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';
import { Readable, PassThrough } from 'stream';

// Mock file-type since it's used for buffer validation
jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn().mockImplementation(async (buffer: Buffer) => {
    // Return null for invalid buffers (first 4 bytes are 0x00, 0x01, 0x02, 0x03)
    if (buffer.length === 4 && buffer[0] === 0x00 && buffer[1] === 0x01) {
      return null;
    }

    // Return pdf for pdf files
    if (buffer.length > 4 && buffer.toString('utf8', 0, 4) === '%PDF') {
      return { ext: 'pdf', mime: 'application/pdf' };
    }

    // Return png for normal buffers
    return { ext: 'png', mime: 'image/png' };
  }),
}));

// Mock sharp since vips/sharp compatibility issues in test environment
jest.mock('sharp', () => {
  const { PassThrough } = require('stream');

  // Create a mock that extends PassThrough properly
  class MockSharpStream extends PassThrough {
    toFormat = jest.fn().mockReturnThis();
    toBuffer = jest.fn().mockResolvedValue(Buffer.from('mocked-transcoded-image'));
    metadata = jest.fn().mockResolvedValue({ format: 'jpeg' });
  }

  const mockSharp = jest.fn().mockImplementation(() => new MockSharpStream());

  mockSharp.cache = jest.fn();
  mockSharp.concurrency = jest.fn();

  return { default: mockSharp, __esModule: true };
});

describe('Image Transcoder Converter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw on providing invalid format buffer', async () => {
    const transcoder = new ImageTranscoder({
      targetFormat: 'jpeg',
    });

    await expect(transcoder.convert<Buffer>(Buffer.from([0x00, 0x01, 0x02, 0x03]))).rejects.toThrow();
  });

  it('should throw on providing unsupported format buffer (pdf)', async () => {
    const transcoder = new ImageTranscoder({
      targetFormat: 'jpeg',
    });

    await expect(transcoder.convert<Buffer>(Buffer.from('%PDF-1.4'))).rejects.toThrow();
  });

  it('should convert png to jpeg from stream to stream', async () => {
    const readStream = new PassThrough();

    readStream.end(Buffer.from('test-image-data'));

    const transcoder = new ImageTranscoder({
      targetFormat: 'jpeg',
    });

    const stream = await transcoder.convert<Readable>(readStream);

    // Stream is returned from sharp mock
    expect(stream).toBeDefined();
  });

  it('should convert png to webp from buffer to buffer', async () => {
    const sourceBuffer = Buffer.from('test-png-image-data');

    const transcoder = new ImageTranscoder({
      targetFormat: 'webp',
    });

    const buffer = await transcoder.convert<Buffer>(sourceBuffer);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.toString()).toBe('mocked-transcoded-image');

    // Verify sharp was called with correct format
    const sharp = jest.requireMock('sharp').default;
    const sharpInstance = sharp.mock.results[0].value;

    expect(sharpInstance.toFormat).toHaveBeenCalledWith('webp', { targetFormat: 'webp' });
  });

  it('should set concurrency when provided', () => {
    const sharp = jest.requireMock('sharp').default;

    new ImageTranscoder({
      targetFormat: 'jpeg',
      concurrency: 4,
    });

    expect(sharp.concurrency).toHaveBeenCalledWith(4);
  });

  it('should default concurrency to 1', () => {
    const sharp = jest.requireMock('sharp').default;

    new ImageTranscoder({
      targetFormat: 'jpeg',
    });

    expect(sharp.concurrency).toHaveBeenCalledWith(1);
  });

  it('should support various output formats', async () => {
    const sourceBuffer = Buffer.from('test-png-image-data');
    const sharp = jest.requireMock('sharp').default;

    const formats = ['jpeg', 'png', 'webp', 'avif', 'gif', 'tiff'] as const;

    for (const format of formats) {
      jest.clearAllMocks();

      const transcoder = new ImageTranscoder({
        targetFormat: format,
      });

      await transcoder.convert<Buffer>(sourceBuffer);

      const sharpInstance = sharp.mock.results[0].value;

      expect(sharpInstance.toFormat).toHaveBeenCalledWith(format, { targetFormat: format });
    }
  });
});
