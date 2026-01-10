# Creating a Storage Adapter

Step-by-step guide to implementing a new storage adapter for `@rytass/storages`.

## When to Create a New Adapter

Create a new adapter when you need to:
- Support a new cloud storage provider (e.g., Backblaze B2, DigitalOcean Spaces)
- Integrate with proprietary storage systems
- Add custom storage behavior or features
- Support S3-compatible services with specific requirements

## Prerequisites

Before starting, ensure you have:
- Understanding of the storage provider's SDK/API
- TypeScript knowledge
- Familiarity with Node.js Buffer and Stream APIs
- Understanding of the [Base Interfaces](BASE-INTERFACES.md)

## Step 1: Package Setup

### Create Package Structure

```
packages/storages-adapter-mycloud/
├── src/
│   ├── storages-adapter-mycloud.ts   # Main implementation
│   ├── typings.ts                    # Type definitions
│   └── index.ts                      # Package exports
├── __tests__/
│   └── storages-adapter-mycloud.spec.ts
├── __fixtures__/
│   └── test-file.png                  # Test assets
├── package.json
├── tsconfig.build.json
└── README.md
```

### Package Naming Convention

Follow the pattern: `@rytass/storages-adapter-{provider}`

Examples:
- `@rytass/storages-adapter-s3`
- `@rytass/storages-adapter-gcs`
- `@rytass/storages-adapter-backblaze`

### package.json

```json
{
  "name": "@rytass/storages-adapter-mycloud",
  "version": "0.1.0",
  "description": "MyCloud storage adapter for @rytass/storages",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "jest"
  },
  "keywords": [
    "storage",
    "mycloud",
    "file-upload",
    "rytass"
  ],
  "dependencies": {
    "@rytass/storages": "^0.2.5",
    "mycloud-sdk": "^1.0.0",
    "uuid": "^13.0.0"
  },
  "peerDependencies": {
    "@rytass/storages": "^0.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/uuid": "^10.0.0",
    "typescript": "^5.0.0",
    "jest": "^29.0.0"
  }
}
```

## Step 2: Define Configuration Interface

Create `src/typings.ts`:

```typescript
import { StorageOptions } from '@rytass/storages';

export interface MyCloudOptions extends StorageOptions {
  // Required parameters
  apiKey: string;
  endpoint: string;
  bucket: string;

  // Optional parameters
  timeout?: number;
  maxRetries?: number;
  customHeader?: string;
}
```

**Guidelines:**
- Extend `StorageOptions` to inherit `converters` and `hashAlgorithm`
- Mark required parameters explicitly (no `?`)
- Provide sensible defaults for optional parameters in constructor
- Document each parameter with JSDoc comments

## Step 3: Implement Storage Class

Create `src/storages-adapter-mycloud.ts`:

```typescript
import {
  Storage,
  StorageFile,
  InputFile,
  WriteFileOptions,
  ReadBufferFileOptions,
  ReadStreamFileOptions,
  StorageError,
  ErrorCode,
} from '@rytass/storages';
import { Readable, PassThrough } from 'stream';
import { v4 as uuid } from 'uuid';
import { MyCloudSDK } from 'mycloud-sdk';
import { MyCloudOptions } from './typings';

export class MyCloudStorage extends Storage<MyCloudOptions> {
  private readonly client: MyCloudSDK;
  private readonly bucket: string;

  constructor(options: MyCloudOptions) {
    super(options);

    // Initialize provider SDK
    this.client = new MyCloudSDK({
      apiKey: options.apiKey,
      endpoint: options.endpoint,
      timeout: options.timeout || 30000,
    });

    this.bucket = options.bucket;
  }

  // Implement required methods below...
}
```

## Step 4: Implement Required Methods

### Implement `write()` Method

```typescript
write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
  if (file instanceof Buffer) {
    return this.writeBufferFile(file, options);
  }
  return this.writeStreamFile(file as Readable, options);
}

private async writeBufferFile(
  buffer: Buffer,
  options?: WriteFileOptions
): Promise<StorageFile> {
  // 1. Apply file converters
  const convertedBuffer = await this.converterManager.convert<Buffer>(buffer);

  // 2. Determine filename
  const fileInfo = options?.filename || (await this.getBufferFilename(convertedBuffer));
  const filename = Array.isArray(fileInfo) ? fileInfo[0] : fileInfo;
  const mimeType = Array.isArray(fileInfo) ? fileInfo[1] : undefined;

  // 3. Prepare metadata
  const contentType = options?.contentType || mimeType || 'application/octet-stream';

  // 4. Upload to provider
  try {
    await this.client.upload({
      bucket: this.bucket,
      key: filename,
      body: convertedBuffer,
      contentType,
    });

    return { key: filename };
  } catch (error) {
    throw new StorageError(
      ErrorCode.WRITE_FILE_ERROR,
      `Failed to upload to MyCloud: ${error.message}`
    );
  }
}

private async writeStreamFile(
  stream: Readable,
  options?: WriteFileOptions
): Promise<StorageFile> {
  // 1. Apply file converters
  const convertedStream = await this.converterManager.convert<Readable>(stream);

  // 2. Handle custom filename
  if (options?.filename) {
    await this.client.upload({
      bucket: this.bucket,
      key: options.filename,
      body: convertedStream,
      contentType: options.contentType,
    });

    return { key: options.filename };
  }

  // 3. For auto-generated filename, need to process stream
  // Use PassThrough to avoid consuming stream
  const uploadStream = new PassThrough();
  const hashStream = new PassThrough();

  convertedStream.pipe(uploadStream);
  convertedStream.pipe(hashStream);

  // Upload with temporary name
  const tempFilename = uuid();
  const uploadPromise = this.client.upload({
    bucket: this.bucket,
    key: tempFilename,
    body: uploadStream,
  });

  // Generate hash-based filename in parallel
  const [filename, mimeType] = await Promise.all([
    this.getStreamFilename(hashStream),
    uploadPromise,
  ]);

  // Rename/move file to final name
  await this.client.copy({
    sourceBucket: this.bucket,
    sourceKey: tempFilename,
    destinationBucket: this.bucket,
    destinationKey: filename[0],
    contentType: options?.contentType || mimeType || filename[1],
  });

  // Delete temporary file
  await this.client.delete({
    bucket: this.bucket,
    key: tempFilename,
  });

  return { key: filename[0] };
}
```

### Implement `batchWrite()` Method

```typescript
batchWrite(
  files: InputFile[],
  options?: WriteFileOptions[]
): Promise<StorageFile[]> {
  // Upload all files in parallel
  return Promise.all(
    files.map((file, index) => this.write(file, options?.[index]))
  );
}
```

**Alternative:** Use provider's batch upload API if available:

```typescript
async batchWrite(
  files: InputFile[],
  options?: WriteFileOptions[]
): Promise<StorageFile[]> {
  // If provider supports batch upload
  if (this.client.batchUpload) {
    const results = await this.client.batchUpload(files, options);
    return results.map(r => ({ key: r.key }));
  }

  // Fallback to parallel individual uploads
  return Promise.all(
    files.map((file, index) => this.write(file, options?.[index]))
  );
}
```

### Implement `read()` Method

```typescript
read(key: string): Promise<Readable>;
read(key: string, options: ReadBufferFileOptions): Promise<Buffer>;
read(key: string, options: ReadStreamFileOptions): Promise<Readable>;
async read(
  key: string,
  options?: ReadBufferFileOptions | ReadStreamFileOptions
): Promise<Buffer | Readable> {
  try {
    const response = await this.client.download({
      bucket: this.bucket,
      key,
    });

    // Provider returns stream
    const stream = response.body as Readable;

    if (options?.format === 'buffer') {
      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }

    // Return stream
    return stream;
  } catch (error) {
    if (error.code === 'NoSuchKey' || error.code === 'NotFound') {
      throw new StorageError(ErrorCode.FILE_NOT_FOUND, `File not found: ${key}`);
    }
    throw new StorageError(
      ErrorCode.READ_FILE_ERROR,
      `Failed to read from MyCloud: ${error.message}`
    );
  }
}
```

### Implement `remove()` Method

```typescript
async remove(key: string): Promise<void> {
  try {
    await this.client.delete({
      bucket: this.bucket,
      key,
    });
  } catch (error) {
    // Ignore not-found errors (idempotent operation)
    if (error.code === 'NoSuchKey' || error.code === 'NotFound') {
      return;
    }
    throw new StorageError(
      ErrorCode.REMOVE_FILE_ERROR,
      `Failed to delete from MyCloud: ${error.message}`
    );
  }
}
```

### Implement `isExists()` Method

```typescript
async isExists(key: string): Promise<boolean> {
  try {
    await this.client.head({
      bucket: this.bucket,
      key,
    });
    return true;
  } catch (error) {
    return false; // Return false instead of throwing
  }
}
```

## Step 5: Optional Features

### Implement Presigned URL Generation

```typescript
async url(key: string, options?: { expires?: number }): Promise<string> {
  const expires = options?.expires || Date.now() + 1000 * 60 * 60 * 24; // 24 hours

  try {
    const url = await this.client.getSignedUrl({
      bucket: this.bucket,
      key,
      expires,
      action: 'read',
    });

    return url;
  } catch (error) {
    throw new StorageError(
      ErrorCode.READ_FILE_ERROR,
      `Failed to generate URL: ${error.message}`
    );
  }
}
```

### Add Custom Helper Methods

```typescript
// Example: Get object metadata
async getMetadata(key: string): Promise<ObjectMetadata> {
  const response = await this.client.head({
    bucket: this.bucket,
    key,
  });

  return {
    size: response.contentLength,
    contentType: response.contentType,
    lastModified: response.lastModified,
  };
}
```

## Step 6: Package Exports

Create `src/index.ts`:

```typescript
export * from './storages-adapter-mycloud';
export * from './typings';
```

## Step 7: Testing

Create `__tests__/storages-adapter-mycloud.spec.ts`:

```typescript
import { MyCloudStorage } from '../src';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock the SDK
jest.mock('mycloud-sdk');

describe('MyCloudStorage', () => {
  let storage: MyCloudStorage;

  beforeEach(() => {
    storage = new MyCloudStorage({
      apiKey: 'test-api-key',
      endpoint: 'https://test.mycloud.com',
      bucket: 'test-bucket',
    });
  });

  describe('write()', () => {
    it('should upload Buffer file', async () => {
      const buffer = Buffer.from('test content');
      const result = await storage.write(buffer, {
        filename: 'test.txt',
      });

      expect(result.key).toBe('test.txt');
    });

    it('should auto-generate filename', async () => {
      const buffer = Buffer.from('test content');
      const result = await storage.write(buffer);

      expect(result.key).toMatch(/^[a-f0-9]{64}\./); // Hash-based
    });
  });

  describe('read()', () => {
    it('should download as Buffer', async () => {
      const buffer = await storage.read('test.txt', { format: 'buffer' });

      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('should throw FILE_NOT_FOUND for missing file', async () => {
      await expect(
        storage.read('missing.txt', { format: 'buffer' })
      ).rejects.toThrow('File not found');
    });
  });

  describe('remove()', () => {
    it('should delete file', async () => {
      await expect(storage.remove('test.txt')).resolves.toBeUndefined();
    });

    it('should not throw for missing file', async () => {
      await expect(storage.remove('missing.txt')).resolves.toBeUndefined();
    });
  });

  describe('isExists()', () => {
    it('should return true for existing file', async () => {
      const exists = await storage.isExists('test.txt');
      expect(exists).toBe(true);
    });

    it('should return false for missing file', async () => {
      const exists = await storage.isExists('missing.txt');
      expect(exists).toBe(false);
    });
  });

  describe('batchWrite()', () => {
    it('should upload multiple files', async () => {
      const files = [
        Buffer.from('content 1'),
        Buffer.from('content 2'),
        Buffer.from('content 3'),
      ];

      const results = await storage.batchWrite(files, [
        { filename: 'file1.txt' },
        { filename: 'file2.txt' },
        { filename: 'file3.txt' },
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].key).toBe('file1.txt');
    });
  });
});
```

## Implementation Checklist

Before publishing your adapter, ensure:

- [ ] Extends `Storage<YourOptions>` base class
- [ ] Implements all required methods (`write`, `batchWrite`, `read`, `remove`, `isExists`)
- [ ] Handles both Buffer and Stream inputs
- [ ] Uses hash-based filename generation (`getBufferFilename`, `getStreamFilename`)
- [ ] Integrates file converter system (`converterManager.convert()`)
- [ ] Throws appropriate `StorageError` with correct `ErrorCode`
- [ ] Handles provider errors gracefully
- [ ] `remove()` is idempotent (doesn't throw if file missing)
- [ ] `isExists()` returns `false` instead of throwing
- [ ] Has comprehensive unit tests
- [ ] Has README with usage examples
- [ ] TypeScript types are exported
- [ ] Follows semver versioning

## Common Patterns

### Pattern 1: File Renaming with Temporary Upload

When you need the file hash but the provider doesn't support renaming:

```typescript
// 1. Upload with temporary name
const tempKey = uuid();
await provider.upload(tempKey, stream);

// 2. Generate hash-based name
const [finalKey] = await this.getStreamFilename(stream);

// 3. Copy to final name
await provider.copy(tempKey, finalKey);

// 4. Delete temporary file
await provider.delete(tempKey);
```

### Pattern 2: Stream Consumption Prevention

Use PassThrough to avoid consuming streams:

```typescript
const uploadStream = new PassThrough();
const hashStream = new PassThrough();

originalStream.pipe(uploadStream);
originalStream.pipe(hashStream);

// Both can now be used independently
await Promise.all([
  provider.upload(uploadStream),
  this.getStreamFilename(hashStream),
]);
```

### Pattern 3: Error Translation

Convert provider errors to standard `StorageError`:

```typescript
try {
  await provider.operation();
} catch (error) {
  // Check for specific error types
  if (error.code === 'NotFound' || error.statusCode === 404) {
    throw new StorageError(ErrorCode.FILE_NOT_FOUND);
  }

  if (error.code === 'AccessDenied' || error.statusCode === 403) {
    throw new StorageError(ErrorCode.WRITE_FILE_ERROR, 'Access denied');
  }

  // Generic error
  throw new StorageError(
    ErrorCode.UNRECOGNIZED_ERROR,
    `Provider error: ${error.message}`
  );
}
```

### Pattern 4: Metadata Preservation

Preserve file type information:

```typescript
const [filename, mimeType] = await this.getBufferFilename(buffer);

await provider.upload({
  key: filename,
  body: buffer,
  contentType: options?.contentType || mimeType || 'application/octet-stream',
  metadata: {
    originalName: options?.filename,
    uploadedAt: new Date().toISOString(),
  },
});
```

## Complete Example

Here's a simplified in-memory storage adapter for reference:

```typescript
import { Storage, StorageFile, InputFile, WriteFileOptions } from '@rytass/storages';

interface MemoryStorageOptions extends StorageOptions {
  // No additional options needed
}

class MemoryStorage extends Storage<MemoryStorageOptions> {
  private storage: Map<string, Buffer> = new Map();

  async write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
    // Convert to buffer
    const buffer = file instanceof Buffer
      ? file
      : await this.streamToBuffer(file);

    // Get filename
    const fileInfo = options?.filename || (await this.getBufferFilename(buffer));
    const filename = Array.isArray(fileInfo) ? fileInfo[0] : fileInfo;

    // Store in memory
    this.storage.set(filename, buffer);

    return { key: filename };
  }

  async batchWrite(files: InputFile[]): Promise<StorageFile[]> {
    return Promise.all(files.map(file => this.write(file)));
  }

  async read(key: string, options?: any): Promise<any> {
    const buffer = this.storage.get(key);
    if (!buffer) {
      throw new StorageError(ErrorCode.FILE_NOT_FOUND);
    }

    if (options?.format === 'buffer') {
      return buffer;
    }

    return Readable.from(buffer);
  }

  async remove(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async isExists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
```

This example demonstrates all required methods in a simplified implementation.
