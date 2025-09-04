# Rytass Utils - Storages

A unified file storage interface for the Rytass ecosystem. Provides a consistent API for managing files across different storage backends including local disk, cloud storage providers, and content delivery networks.

## Features

- [x] Unified storage interface across providers
- [x] Buffer and Stream support
- [x] Automatic content type detection
- [x] File existence checking
- [x] Batch operations
- [x] TypeScript support
- [x] Extensible architecture

## Installation

```bash
npm install @rytass/storages
# or
yarn add @rytass/storages
```

## Available Adapters

- **[@rytass/storages-adapter-local](https://www.npmjs.com/package/@rytass/storages-adapter-local)** - Local disk storage
- **[@rytass/storages-adapter-s3](https://www.npmjs.com/package/@rytass/storages-adapter-s3)** - Amazon S3 storage
- **[@rytass/storages-adapter-r2](https://www.npmjs.com/package/@rytass/storages-adapter-r2)** - Cloudflare R2 storage
- **[@rytass/storages-adapter-gcs](https://www.npmjs.com/package/@rytass/storages-adapter-gcs)** - Google Cloud Storage
- **[@rytass/storages-adapter-azure-blob](https://www.npmjs.com/package/@rytass/storages-adapter-azure-blob)** - Azure Blob Storage

## Basic Usage

### Using with S3 Adapter

```typescript
import { StorageS3Service } from '@rytass/storages-adapter-s3';

const storage = new StorageS3Service({
  region: 'us-west-2',
  bucket: 'my-bucket',
  credentials: {
    accessKeyId: 'your-access-key',
    secretAccessKey: 'your-secret-key',
  },
});

// Upload file
const result = await storage.write(buffer, {
  filename: 'documents/file.pdf',
  contentType: 'application/pdf',
});

// Download file
const fileBuffer = await storage.read('documents/file.pdf', { format: 'buffer' });

// Generate signed URL
const url = await storage.url('documents/file.pdf');
```

### Using with Local Storage

```typescript
import { StorageLocalService } from '@rytass/storages-adapter-local';

const storage = new StorageLocalService({
  baseDir: './uploads',
});

// Upload file
const result = await storage.write(buffer, {
  filename: 'images/photo.jpg',
});

// Read file
const fileStream = await storage.read('images/photo.jpg');
```

## Core Concepts

### Storage Interface

All storage adapters implement the base `Storage` interface:

```typescript
abstract class Storage<Options extends StorageOptions> {
  abstract url(key: string, expires?: number): Promise<string>;
  abstract read(key: string): Promise<Readable>;
  abstract read(key: string, options: ReadBufferFileOptions): Promise<Buffer>;
  abstract read(key: string, options: ReadStreamFileOptions): Promise<Readable>;
  abstract write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile>;
  abstract batchWrite(files: InputFile[]): Promise<StorageFile[]>;
  abstract remove(key: string): Promise<void>;
  abstract isExists(filename: string): Promise<boolean>;
}
```

### File Types

```typescript
type InputFile = Buffer | Readable;

interface StorageFile {
  key: string;
}
```

### Options

```typescript
interface WriteFileOptions {
  filename?: string;
  contentType?: string;
}

interface ReadBufferFileOptions {
  format: 'buffer';
}

interface ReadStreamFileOptions {
  format: 'stream';
}
```

## Advanced Usage

### Multi-Provider Storage Manager

```typescript
import { StorageS3Service } from '@rytass/storages-adapter-s3';
import { StorageLocalService } from '@rytass/storages-adapter-local';
import { Storage } from '@rytass/storages';

class MultiStorageManager {
  private primaryStorage: Storage<any>;
  private backupStorage: Storage<any>;

  constructor() {
    this.primaryStorage = new StorageS3Service({
      region: 'us-west-2',
      bucket: 'primary-bucket',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    this.backupStorage = new StorageLocalService({
      baseDir: './backup-storage',
    });
  }

  async uploadWithBackup(file: Buffer, filename: string) {
    try {
      // Upload to primary storage
      const primaryResult = await this.primaryStorage.write(file, { filename });

      // Backup to local storage
      const backupResult = await this.backupStorage.write(file, { filename });

      return {
        primary: primaryResult,
        backup: backupResult,
      };
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }

  async downloadWithFallback(key: string): Promise<Buffer> {
    try {
      // Try primary storage first
      return await this.primaryStorage.read(key, { format: 'buffer' });
    } catch (error) {
      console.warn('Primary storage failed, trying backup:', error);
      // Fallback to backup storage
      return await this.backupStorage.read(key, { format: 'buffer' });
    }
  }
}
```

### Storage Proxy with Caching

```typescript
import { Storage, InputFile, WriteFileOptions, StorageFile } from '@rytass/storages';

class CachedStorageProxy extends Storage<any> {
  private cache = new Map<string, Buffer>();
  private baseStorage: Storage<any>;

  constructor(baseStorage: Storage<any>) {
    super({} as any);
    this.baseStorage = baseStorage;
  }

  async url(key: string, expires?: number): Promise<string> {
    return this.baseStorage.url(key, expires);
  }

  async read(key: string): Promise<Readable>;
  async read(key: string, options: ReadBufferFileOptions): Promise<Buffer>;
  async read(key: string, options: ReadStreamFileOptions): Promise<Readable>;
  async read(key: string, options?: any): Promise<any> {
    // Check cache for buffer reads
    if (options?.format === 'buffer' && this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const result = await this.baseStorage.read(key, options);

    // Cache buffer results
    if (options?.format === 'buffer' && Buffer.isBuffer(result)) {
      this.cache.set(key, result);
    }

    return result;
  }

  async write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
    const result = await this.baseStorage.write(file, options);

    // Invalidate cache if file was overwritten
    if (options?.filename && this.cache.has(options.filename)) {
      this.cache.delete(options.filename);
    }

    return result;
  }

  async batchWrite(files: InputFile[]): Promise<StorageFile[]> {
    return this.baseStorage.batchWrite(files);
  }

  async remove(key: string): Promise<void> {
    await this.baseStorage.remove(key);
    this.cache.delete(key);
  }

  async isExists(filename: string): Promise<boolean> {
    return this.baseStorage.isExists(filename);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
```

## Integration Examples

### Express.js File Upload

```typescript
import express from 'express';
import multer from 'multer';
import { StorageS3Service } from '@rytass/storages-adapter-s3';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const storage = new StorageS3Service({
  region: 'us-west-2',
  bucket: 'uploads-bucket',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await storage.write(req.file.buffer, {
      filename: `uploads/${Date.now()}-${req.file.originalname}`,
      contentType: req.file.mimetype,
    });

    const publicUrl = await storage.url(result.key);

    res.json({
      success: true,
      key: result.key,
      url: publicUrl,
      filename: req.file.originalname,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get('/file/:key(*)', async (req, res) => {
  try {
    const key = req.params.key;
    const fileBuffer = await storage.read(key, { format: 'buffer' });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(fileBuffer);
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});
```

### NestJS Service

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageS3Service } from '@rytass/storages-adapter-s3';
import { StorageLocalService } from '@rytass/storages-adapter-local';

@Injectable()
export class FileStorageService {
  private storage: StorageS3Service | StorageLocalService;

  constructor(private configService: ConfigService) {
    const storageType = this.configService.get('STORAGE_TYPE');

    if (storageType === 's3') {
      this.storage = new StorageS3Service({
        region: this.configService.get('AWS_REGION')!,
        bucket: this.configService.get('S3_BUCKET')!,
        credentials: {
          accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID')!,
          secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY')!,
        },
      });
    } else {
      this.storage = new StorageLocalService({
        baseDir: this.configService.get('LOCAL_STORAGE_DIR', './uploads'),
      });
    }
  }

  async uploadFile(file: Buffer, filename: string, contentType?: string) {
    return this.storage.write(file, { filename, contentType });
  }

  async downloadFile(key: string): Promise<Buffer> {
    return this.storage.read(key, { format: 'buffer' });
  }

  async getFileUrl(key: string): Promise<string> {
    return this.storage.url(key);
  }

  async deleteFile(key: string): Promise<void> {
    return this.storage.remove(key);
  }

  async fileExists(key: string): Promise<boolean> {
    return this.storage.isExists(key);
  }
}
```

## Error Handling

```typescript
import { StorageError, ErrorCode } from '@rytass/storages';

async function safeFileOperation(storage: Storage<any>, key: string) {
  try {
    const exists = await storage.isExists(key);
    if (!exists) {
      throw new StorageError(ErrorCode.READ_FILE_ERROR, 'File not found');
    }

    return await storage.read(key, { format: 'buffer' });
  } catch (error) {
    if (error instanceof StorageError) {
      console.error('Storage error:', error.code, error.message);
    } else {
      console.error('Unexpected error:', error);
    }
    throw error;
  }
}
```

## File Processing Pipeline

```typescript
import { ConverterManager } from '@rytass/file-converter';
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { Storage } from '@rytass/storages';

class FileProcessor {
  constructor(
    private storage: Storage<any>,
    private converter: ConverterManager,
  ) {}

  async processAndStore(originalFile: Buffer, key: string) {
    // Process the file
    const processedFile = await this.converter.convert<Buffer>(originalFile);

    // Store both original and processed versions
    const [originalResult, processedResult] = await Promise.all([
      this.storage.write(originalFile, {
        filename: `originals/${key}`,
        contentType: 'image/jpeg',
      }),
      this.storage.write(processedFile, {
        filename: `processed/${key}`,
        contentType: 'image/webp',
      }),
    ]);

    return {
      original: {
        key: originalResult.key,
        url: await this.storage.url(originalResult.key),
      },
      processed: {
        key: processedResult.key,
        url: await this.storage.url(processedResult.key),
      },
    };
  }
}
```

## Best Practices

### Security

- Use environment variables for credentials
- Implement proper access controls
- Validate file types before upload
- Sanitize file names
- Use signed URLs for temporary access

### Performance

- Use streams for large files
- Implement caching for frequently accessed files
- Use batch operations when possible
- Choose appropriate storage classes/tiers

### Cost Optimization

- Monitor storage usage
- Set up lifecycle policies
- Use appropriate redundancy levels
- Optimize file sizes before storage

### File Organization

- Use consistent naming conventions
- Organize files in logical directory structures
- Implement proper versioning
- Consider data retention policies

## API Reference

### Storage Abstract Class

```typescript
abstract class Storage<Options extends StorageOptions> {
  constructor(options: Options);
  abstract url(key: string, expires?: number): Promise<string>;
  abstract read(key: string): Promise<Readable>;
  abstract read(key: string, options: ReadBufferFileOptions): Promise<Buffer>;
  abstract read(key: string, options: ReadStreamFileOptions): Promise<Readable>;
  abstract write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile>;
  abstract batchWrite(files: InputFile[]): Promise<StorageFile[]>;
  abstract remove(key: string): Promise<void>;
  abstract isExists(filename: string): Promise<boolean>;
}
```

### Error Types

```typescript
enum ErrorCode {
  READ_FILE_ERROR = 'READ_FILE_ERROR',
  WRITE_FILE_ERROR = 'WRITE_FILE_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND'
}

class StorageError extends Error {
  constructor(public code: ErrorCode, message: string);
}
```

## License

MIT
