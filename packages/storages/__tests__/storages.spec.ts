/**
 * @jest-environment node
 */

import { resolve } from 'path';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import { readFileSync, createReadStream } from 'fs';
import { Storage } from '../src';

describe('Storage', () => {
  describe('Filename getter', () => {
    const sampleFilePath = resolve(__dirname, '../__fixtures__/test-image.png');
    const sampleFileBuffer = readFileSync(sampleFilePath);
    const filename = `${createHash('sha256').update(sampleFileBuffer).digest('hex')}.png`;

    const storage = new Storage();

    it('should get buffer filename', async () => {
      const [resolvedFilename] = await storage.getBufferFilename(sampleFileBuffer);

      expect(resolvedFilename).toBe(filename);
    });

    it('should get stream filename', async () => {
      const [resolvedFilename] = await storage.getStreamFilename(createReadStream(sampleFilePath));

      expect(resolvedFilename).toBe(filename);
    });

    it('should no extensions when file type detection failed (Stream)', async () => {
      const [filename] = await storage.getStreamFilename(Readable.from(Buffer.from([0xb5, 0xa1])));

      expect(filename).toBe(
        createHash('sha256')
          .update(Buffer.from([0xb5, 0xa1]))
          .digest('hex'),
      );
    });

    it('should no extensions when file type detection failed (Buffer)', async () => {
      const [filename] = await storage.getBufferFilename(Buffer.from([0xb5, 0xa1]));

      expect(filename).toBe(
        createHash('sha256')
          .update(Buffer.from([0xb5, 0xa1]))
          .digest('hex'),
      );
    });

    it('should get extension from buffer', async () => {
      const extension = await storage.getExtension(sampleFileBuffer);

      expect(extension?.ext).toBe('png');
      expect(extension?.mime).toBe('image/png');
    });

    it('should get extension from stream', async () => {
      const extension = await storage.getExtension(createReadStream(sampleFilePath));

      expect(extension?.ext).toBe('png');
      expect(extension?.mime).toBe('image/png');
    });

    it('should get filename stream can handle multiple chunk stream, unknown file type', done => {
      const stream = new Readable({
        read() {},
      });

      storage.getStreamFilename(stream).then(([resolvedFilename]) => {
        expect(resolvedFilename).toMatch(/^[0-f]+$/);

        done();
      });

      stream.push(
        Buffer.from([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      );

      setImmediate(() => {
        stream.push(
          Buffer.from([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
        );

        stream.push(null);
      });
    });

    it('should get filename stream can handle multiple chunk stream', done => {
      const stream = new Readable({
        read() {},
      });

      storage.getStreamFilename(stream).then(([resolvedFilename]) => {
        expect(resolvedFilename).toBe(filename);

        done();
      });

      stream.push(sampleFileBuffer.subarray(0, 4));

      setImmediate(() => {
        stream.push(sampleFileBuffer.subarray(4, 8));
        stream.push(sampleFileBuffer.subarray(8));
        stream.push(null);
      });
    });

    it('should get filename stream can handle multiple chunk stream, first chunk result', done => {
      const stream = new Readable({
        read() {},
      });

      storage.getStreamFilename(stream).then(([resolvedFilename]) => {
        expect(resolvedFilename).toBe(filename);

        done();
      });

      stream.push(sampleFileBuffer.subarray(0, 32));

      setImmediate(() => {
        stream.push(sampleFileBuffer.subarray(32));
        stream.push(null);
      });
    });

    it('should get filename stream can handle multiple chunk stream, first chunk result with delay', done => {
      const stream = new Readable({
        read() {},
      });

      storage.getStreamFilename(stream).then(([resolvedFilename]) => {
        expect(resolvedFilename).toBe(filename);

        done();
      });

      stream.push(sampleFileBuffer.subarray(0, 32));

      setImmediate(() => {
        stream.push(sampleFileBuffer.subarray(32));
        stream.push(null);
      });
    });
  });

  describe('Not implement methods', () => {
    const storage = new Storage();

    it('should subclass method not be implemented', () => {
      expect(() => storage.read('file')).toThrow();
      expect(() => storage.remove('file')).toThrow();
      expect(() => storage.isExists('file')).toThrow();
      expect(() => storage.write(Buffer.from([]))).toThrow();
      expect(() => storage.batchWrite([Buffer.from([])])).toThrow();
    });
  });
});
