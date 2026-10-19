/**
 * @jest-environment node
 */

// Mock fs modules before importing
jest.doMock('fs', () => {
  const { fs } = require('memfs');

  return fs;
});

jest.doMock('fs/promises', () => {
  const { fs } = require('memfs');

  return fs.promises;
});

// Normal static imports
import { LocalStorage, StorageLocalOptions } from '../src';
import { vol } from 'memfs';
import { createHash } from 'crypto';
import { Readable } from 'stream';

describe('StorageLocalService', (): void => {
  const testWorkingDirectory: string = '/test/tmp';

  describe('Basic Features', (): void => {
    const sampleImageBuffer: Buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const mockFileBuffer: Buffer = Buffer.from([0x1f, 0x49, 0xf2]);

    const expectedFilename: string = `${createHash('sha256').update(sampleImageBuffer).digest('hex')}.png`;

    let _batchTestFileKeys: string[] = [];

    beforeEach((): void => {
      // Reset virtual file system
      vol.reset();

      // Setup test files and ensure parent directories exist
      vol.fromJSON({
        '/test/fixtures/test-image.png': sampleImageBuffer,
        '/test/tmp': null, // Create directory
        '/test': null, // Ensure parent directory exists
      });
    });

    describe('writeFileOperations', (): void => {
      it('shouldWriteBufferFile', async (): Promise<void> => {
        const localStorage: LocalStorage = new LocalStorage({
          directory: testWorkingDirectory,
          autoMkdir: true,
        });

        const writeResult = await localStorage.write(sampleImageBuffer);

        expect(writeResult.key).toBeTruthy();
        expect(typeof writeResult.key).toBe('string');
        expect(writeResult.key).toBe(expectedFilename);
      });

      it('shouldWriteStreamFile', async (): Promise<void> => {
        const fileStream: Readable = new Readable({
          read(): void {
            this.push(sampleImageBuffer);
            this.push(null);
          },
        });

        const localStorage: LocalStorage = new LocalStorage({
          directory: testWorkingDirectory,
          autoMkdir: true,
        });

        const writeResult = await localStorage.write(fileStream);

        expect(writeResult.key).toBeTruthy();
        expect(typeof writeResult.key).toBe('string');
      });

      it('shouldBatchWriteFiles', async (): Promise<void> => {
        const localStorage: LocalStorage = new LocalStorage({
          directory: testWorkingDirectory,
          autoMkdir: true,
        });

        const testBuffers: Buffer[] = [sampleImageBuffer, mockFileBuffer];
        const batchWriteResults = await localStorage.batchWrite(testBuffers);

        expect(batchWriteResults).toHaveLength(2);
        expect(batchWriteResults[0].key).toBeTruthy();
        expect(batchWriteResults[1].key).toBeTruthy();

        _batchTestFileKeys = batchWriteResults.map(result => result.key);
      });
    });

    describe('writeFileWithCustomFilename', (): void => {
      const customFileName: string = 'customTestFile.png';

      it('shouldUseCustomFilenameWhenWriteBufferFile', async (): Promise<void> => {
        const localStorage: LocalStorage = new LocalStorage({
          directory: testWorkingDirectory,
          autoMkdir: true,
        });

        const writeResult = await localStorage.write(sampleImageBuffer, {
          filename: customFileName,
        });

        expect(writeResult.key).toBe(customFileName);
      });

      it('shouldUseCustomFilenameWhenWriteStreamFile', async (): Promise<void> => {
        const fileStream: Readable = new Readable({
          read(): void {
            this.push(sampleImageBuffer);
            this.push(null);
          },
        });

        const localStorage: LocalStorage = new LocalStorage({
          directory: testWorkingDirectory,
          autoMkdir: true,
        });

        const writeResult = await localStorage.write(fileStream, {
          filename: customFileName,
        });

        expect(writeResult.key).toBe(customFileName);
      });
    });

    describe('readFileOperations', (): void => {
      it('shouldReadFileBuffer', async (): Promise<void> => {
        const localStorage: LocalStorage = new LocalStorage({
          directory: testWorkingDirectory,
          autoMkdir: true,
        });

        // Write file first
        const writeResult = await localStorage.write(sampleImageBuffer);

        // Then read it
        const readBuffer = await localStorage.read(writeResult.key, {
          format: 'buffer',
        });

        expect(readBuffer.compare(sampleImageBuffer)).toBe(0);
      });

      it('shouldReadFileStream', async (): Promise<void> => {
        const localStorage: LocalStorage = new LocalStorage({
          directory: testWorkingDirectory,
          autoMkdir: true,
        });

        // Write file first
        const writeResult = await localStorage.write(sampleImageBuffer);

        // Then read as stream
        const readStream = await localStorage.read(writeResult.key);

        expect(readStream).toBeInstanceOf(Readable);

        return new Promise<void>(resolve => {
          let accumulatedBuffer = Buffer.from([]);

          readStream.on('data', (chunk: Buffer) => {
            accumulatedBuffer = Buffer.concat([accumulatedBuffer, chunk]);
          });

          readStream.on('end', () => {
            expect(accumulatedBuffer.compare(sampleImageBuffer)).toBe(0);
            resolve();
          });
        });
      });
    });

    describe('removeFileOperations', (): void => {
      it('shouldRemoveFile', async (): Promise<void> => {
        const localStorage: LocalStorage = new LocalStorage({
          directory: testWorkingDirectory,
          autoMkdir: true,
        });

        // Write file first
        const writeResult = await localStorage.write(sampleImageBuffer);

        // Then remove it
        await localStorage.remove(writeResult.key);

        // Verify it's removed
        const fileExists = await localStorage.isExists(writeResult.key);

        expect(fileExists).toBeFalsy();
      });
    });

    describe('fileExistsOperations', (): void => {
      it('shouldCheckFileExists', async (): Promise<void> => {
        const localStorage: LocalStorage = new LocalStorage({
          directory: testWorkingDirectory,
          autoMkdir: true,
        });

        // Write file first
        const writeResult = await localStorage.write(sampleImageBuffer);

        // Check existence
        const notFoundFile = await localStorage.isExists('nonexistent-file.txt');
        const existingFile = await localStorage.isExists(writeResult.key);

        expect(notFoundFile).toBeFalsy();
        expect(existingFile).toBeTruthy();
      });
    });

    afterEach((): void => {
      // Simple reset - no complex cleanup needed
      vol.reset();
      _batchTestFileKeys = [];
    });

    afterAll((): void => {
      vol.reset();
    });
  });

  describe('getUsageInfo', (): void => {
    it('should return filesystem usage info', async (): Promise<void> => {
      // Use actual filesystem for this test since getUsageInfo uses shell commands
      const os = await import('os');
      const path = await import('path');
      const fs = await import('fs');

      const tempDir = path.join(os.tmpdir(), 'storages-local-test-' + Date.now());

      fs.mkdirSync(tempDir, { recursive: true });

      try {
        // Re-import to use real fs instead of memfs
        jest.resetModules();
        jest.unmock('fs');
        jest.unmock('fs/promises');

        const { LocalStorage: RealLocalStorage } = await import('../src');

        const localStorage = new RealLocalStorage({
          directory: tempDir,
          autoMkdir: true,
        });

        const usageInfo = await localStorage.getUsageInfo();

        expect(usageInfo).toHaveProperty('used');
        expect(usageInfo).toHaveProperty('free');
        expect(usageInfo).toHaveProperty('total');
        expect(typeof usageInfo.used).toBe('number');
        expect(typeof usageInfo.free).toBe('number');
        expect(typeof usageInfo.total).toBe('number');
      } finally {
        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('errorHandling', (): void => {
    beforeEach((): void => {
      vol.reset();
    });

    it('shouldThrowIfDirectoryNotExistsAndNoAutoMkdirConfig', (): void => {
      expect(
        () =>
          new LocalStorage({
            directory: testWorkingDirectory,
          }),
      ).toThrow();
    });

    it('shouldThrowIfDirectoryIsAFile', (): void => {
      // Setup: create a file at the directory path
      vol.fromJSON({
        '/test/tmp': Buffer.from([0x00, 0x01]), // File instead of directory
      });

      expect(
        () =>
          new LocalStorage({
            directory: testWorkingDirectory,
          }),
      ).toThrow();
    });

    it('shouldThrowWhenReadNonexistentFile', (): void => {
      vol.fromJSON({
        '/test/tmp': null, // Create directory
      });

      const localStorage: LocalStorage = new LocalStorage({
        directory: testWorkingDirectory,
        autoMkdir: true,
      });

      expect(() => localStorage.read('nonexistent-file.txt')).toThrow();
    });

    it('shouldThrowWhenReadAFolder', (): void => {
      vol.fromJSON({
        '/test/tmp': null, // Create directory
        '/test/tmp/testFolder': null, // Create subdirectory
      });

      const localStorage: LocalStorage = new LocalStorage({
        directory: testWorkingDirectory,
        autoMkdir: true,
      });

      expect(() => localStorage.read('testFolder')).toThrow();
    });

    describe('converters', (): void => {
      const sourceBuffer: Buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const expectedBuffer: Buffer = Buffer.concat([sourceBuffer, Buffer.from([0xff])]);

      const createAppendingConverter = (): { convert: jest.Mock } => ({
        // Appends one 0xff byte, so applying it twice is observable in the stored content
        convert: jest.fn(async (file: Buffer | Readable): Promise<Buffer | Readable> => {
          if (file instanceof Buffer) return Buffer.concat([file, Buffer.from([0xff])]);

          const chunks: Buffer[] = [];

          for await (const chunk of file) chunks.push(chunk as Buffer);

          return Readable.from([Buffer.concat([...chunks, Buffer.from([0xff])])]);
        }),
      });

      const createStorage = (converter: { convert: jest.Mock }): LocalStorage => {
        vol.fromJSON({ '/test/tmp': null });

        return new LocalStorage({
          directory: testWorkingDirectory,
          converters: [converter as unknown as NonNullable<StorageLocalOptions['converters']>[number]],
        });
      };

      it('shouldApplyConvertersOnceWhenWriteBuffer', async (): Promise<void> => {
        const converter = createAppendingConverter();
        const localStorage = createStorage(converter);

        const { key } = await localStorage.write(sourceBuffer);

        expect(converter.convert).toHaveBeenCalledTimes(1);
        expect(key.startsWith(createHash('sha256').update(expectedBuffer).digest('hex'))).toBeTruthy();
        expect(Buffer.compare(vol.readFileSync(`${testWorkingDirectory}/${key}`) as Buffer, expectedBuffer)).toBe(0);
      });

      it('shouldApplyConvertersOnceWhenWriteStream', async (): Promise<void> => {
        const converter = createAppendingConverter();
        const localStorage = createStorage(converter);

        const { key } = await localStorage.write(Readable.from([sourceBuffer]));

        expect(converter.convert).toHaveBeenCalledTimes(1);
        expect(key.startsWith(createHash('sha256').update(expectedBuffer).digest('hex'))).toBeTruthy();
        expect(Buffer.compare(vol.readFileSync(`${testWorkingDirectory}/${key}`) as Buffer, expectedBuffer)).toBe(0);
      });

      it('shouldApplyConvertersOnceWhenWriteStreamWithCustomFilename', async (): Promise<void> => {
        const converter = createAppendingConverter();
        const localStorage = createStorage(converter);

        await localStorage.write(Readable.from([sourceBuffer]), { filename: 'target.png' });

        expect(converter.convert).toHaveBeenCalledTimes(1);
        expect(Buffer.compare(vol.readFileSync(`${testWorkingDirectory}/target.png`) as Buffer, expectedBuffer)).toBe(
          0,
        );
      });
    });

    describe('streamWriteFailures', (): void => {
      const sampleBuffer: Buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      const createErroredSourceStream = (): Readable => {
        const stream = new Readable({
          read(): void {},
        });

        stream.push(sampleBuffer);

        setImmediate(() => {
          stream.destroy(new Error('source failed'));
        });

        return stream;
      };

      const createSourceStream = (): Readable => Readable.from([sampleBuffer]);

      const createStorage = (): LocalStorage => {
        vol.fromJSON({ '/test/tmp': null });

        return new LocalStorage({ directory: testWorkingDirectory, autoMkdir: true });
      };

      it('shouldRejectWhenWriteFailsWithCustomFilename', async (): Promise<void> => {
        const localStorage = createStorage();

        vol.reset();

        await expect(localStorage.write(createSourceStream(), { filename: 'target.png' })).rejects.toThrow(/ENOENT/);
      });

      it('shouldRejectWhenWriteFailsWithoutFilename', async (): Promise<void> => {
        const localStorage = createStorage();

        vol.reset();

        await expect(localStorage.write(createSourceStream())).rejects.toThrow(/ENOENT/);
      });

      it('shouldRejectWhenSourceStreamErrorsWithCustomFilename', async (): Promise<void> => {
        const localStorage = createStorage();

        await expect(localStorage.write(createErroredSourceStream(), { filename: 'target.png' })).rejects.toThrow(
          'source failed',
        );

        expect(vol.readdirSync(testWorkingDirectory)).toEqual([]);
      });

      it('shouldKeepExistingFileWhenSourceStreamErrorsWithCustomFilename', async (): Promise<void> => {
        const localStorage = createStorage();
        const existingContent = Buffer.from('existing content');

        vol.writeFileSync(`${testWorkingDirectory}/target.png`, existingContent);

        await expect(localStorage.write(createErroredSourceStream(), { filename: 'target.png' })).rejects.toThrow(
          'source failed',
        );

        expect(vol.readdirSync(testWorkingDirectory)).toEqual(['target.png']);
        expect(Buffer.compare(vol.readFileSync(`${testWorkingDirectory}/target.png`) as Buffer, existingContent)).toBe(
          0,
        );
      });

      it('shouldReplaceExistingFileWhenWriteSucceedsWithCustomFilename', async (): Promise<void> => {
        const localStorage = createStorage();

        vol.writeFileSync(`${testWorkingDirectory}/target.png`, Buffer.from('existing content'));

        const { key } = await localStorage.write(createSourceStream(), { filename: 'target.png' });

        expect(key).toBe('target.png');
        expect(vol.readdirSync(testWorkingDirectory)).toEqual(['target.png']);
        expect(Buffer.compare(vol.readFileSync(`${testWorkingDirectory}/target.png`) as Buffer, sampleBuffer)).toBe(0);
      });

      it('shouldRejectAndRemoveTempFileWhenSourceStreamErrorsWithoutFilename', async (): Promise<void> => {
        const localStorage = createStorage();

        await expect(localStorage.write(createErroredSourceStream())).rejects.toThrow('source failed');

        expect(vol.readdirSync(testWorkingDirectory)).toEqual([]);
      });

      it('shouldStopWriteAndRemoveTempFileWhenFilenameDetectionFailsFirst', async (): Promise<void> => {
        const localStorage = createStorage();

        jest.spyOn(localStorage, 'getStreamFilename').mockRejectedValue(new Error('hash failed'));

        const source = new Readable({
          read(): void {
            setTimeout(() => this.push(sampleBuffer), 5);
          },
        });

        await expect(localStorage.write(source)).rejects.toThrow('hash failed');

        await new Promise(resolve => setTimeout(resolve, 30));

        expect(source.destroyed).toBeTruthy();
        expect(vol.readdirSync(testWorkingDirectory)).toEqual([]);
      });

      it('shouldKeepSuccessPathWithoutFilename', async (): Promise<void> => {
        const localStorage = createStorage();

        const { key } = await localStorage.write(createSourceStream());

        expect(key.startsWith(createHash('sha256').update(sampleBuffer).digest('hex'))).toBeTruthy();
        expect(vol.readdirSync(testWorkingDirectory)).toEqual([key]);
        expect(Buffer.compare(vol.readFileSync(`${testWorkingDirectory}/${key}`) as Buffer, sampleBuffer)).toBe(0);
      });
    });

    afterEach((): void => {
      vol.reset();
    });
  });
});
