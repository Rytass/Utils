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
      expect(await storage.getBufferFilename(sampleFileBuffer)).toBe(filename);
    });

    it('should get stream filename', async () => {
      expect(await storage.getStreamFilename(
        createReadStream(sampleFilePath)
      )).toBe(filename);
    });

    it('should no extensions when file type detection failed (Stream)', async () => {
      const filename = await storage.getStreamFilename(Readable.from(Buffer.from([0xb5, 0xa1])));

      expect(filename).toBe(createHash('sha256').update(Buffer.from([0xb5, 0xa1])).digest('hex'));
    });

    it('should no extensions when file type detection failed (Buffer)', async () => {
      const filename = await storage.getBufferFilename(Buffer.from([0xb5, 0xa1]));

      expect(filename).toBe(createHash('sha256').update(Buffer.from([0xb5, 0xa1])).digest('hex'));
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
  });

  describe('Not implement methods', () => {
    const storage = new Storage();

    it('should subclass method not be implemented', () => {
      expect(() => storage.read('file')).toThrow();
      expect(() => storage.remove('file')).toThrow();
      expect(() => storage.write(Buffer.from([]))).toThrow();
      expect(() => storage.batchWrite([Buffer.from([])])).toThrow();
    });
  });
});
