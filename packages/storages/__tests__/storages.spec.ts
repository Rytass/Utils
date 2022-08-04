/**
 * @jest-environment node
 */

import { resolve } from 'path';
import { createHash } from 'crypto';
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
