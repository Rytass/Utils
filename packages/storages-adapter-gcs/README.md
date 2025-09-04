# Rytass Utils - Google Cloud Storage Adapter

A powerful Google Cloud Storage adapter for the Rytass file storage system. Provides seamless integration with Google Cloud Storage buckets with support for signed URLs, stream processing, and automatic file type detection.

## Features

- [x] Google Cloud Storage bucket integration
- [x] Signed URL generation for secure file access
- [x] Buffer and Stream file operations
- [x] Automatic content type detection
- [x] Batch file operations
- [x] File existence checking
- [x] GZIP compression support
- [x] Service account authentication
- [x] TypeScript support

## Installation

```bash
npm install @rytass/storages-adapter-gcs @google-cloud/storage
# or
yarn add @rytass/storages-adapter-gcs @google-cloud/storage
```

## Basic Usage

### Service Configuration

```typescript
import { StorageGCSService } from '@rytass/storages-adapter-gcs';

const storage = new StorageGCSService({
  bucket: 'your-gcs-bucket-name',
  projectId: 'your-gcp-project-id',
  credentials: {
    client_email: 'your-service-account@project.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
  },
});
```

### Upload Files

```typescript
import { readFileSync, createReadStream } from 'fs';

// Upload buffer
const imageBuffer = readFileSync('photo.jpg');
const result = await storage.write(imageBuffer, {
  filename: 'uploads/photo.jpg',
  contentType: 'image/jpeg',
});
console.log('Uploaded:', result.key);

// Upload stream
const fileStream = createReadStream('document.pdf');
const streamResult = await storage.write(fileStream, {
  filename: 'documents/document.pdf',
  contentType: 'application/pdf',
});
console.log('Uploaded:', streamResult.key);

// Auto-generated filename (based on file content)
const autoResult = await storage.write(imageBuffer);
console.log('Auto-generated filename:', autoResult.key);
```

### Download Files

```typescript
// Download as buffer
const fileBuffer = await storage.read('uploads/photo.jpg', { format: 'buffer' });
console.log('Downloaded buffer:', fileBuffer.length, 'bytes');

// Download as stream
const fileStream = await storage.read('uploads/photo.jpg');
fileStream.pipe(process.stdout);

// Stream to file
import { createWriteStream } from 'fs';
const downloadStream = await storage.read('documents/document.pdf');
const writeStream = createWriteStream('downloaded-document.pdf');
downloadStream.pipe(writeStream);
```

### Generate Signed URLs

```typescript
// Default expiration (24 hours)
const url = await storage.url('uploads/photo.jpg');
console.log('Signed URL:', url);

// Custom expiration (1 hour from now)
const customUrl = await storage.url('uploads/photo.jpg', Date.now() + 1000 * 60 * 60);
console.log('1-hour URL:', customUrl);

// Use in HTML
const publicUrl = await storage.url('images/avatar.png');
// <img src="${publicUrl}" alt="User Avatar" />
```

### File Management

```typescript
// Check if file exists
const exists = await storage.isExists('uploads/photo.jpg');
if (exists) {
  console.log('File exists');
}

// Remove file
await storage.remove('uploads/old-file.jpg');
console.log('File removed');

// Batch upload
const files = [readFileSync('file1.jpg'), readFileSync('file2.png'), createReadStream('file3.pdf')];

const batchResults = await storage.batchWrite(files);
batchResults.forEach(result => {
  console.log('Uploaded:', result.key);
});
```

## Advanced Usage

### Environment-based Configuration

```typescript
// .env file
// GCS_BUCKET=your-bucket-name
// GCS_PROJECT_ID=your-project-id
// GCS_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
// GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

import { StorageGCSService } from '@rytass/storages-adapter-gcs';

const storage = new StorageGCSService({
  bucket: process.env.GCS_BUCKET!,
  projectId: process.env.GCS_PROJECT_ID!,
  credentials: {
    client_email: process.env.GCS_CLIENT_EMAIL!,
    private_key: process.env.GCS_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  },
});
```

### Service Account Key File

```typescript
import { readFileSync } from 'fs';

// Load service account key from JSON file
const serviceAccount = JSON.parse(readFileSync('path/to/service-account-key.json', 'utf8'));

const storage = new StorageGCSService({
  bucket: 'your-bucket-name',
  projectId: serviceAccount.project_id,
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key,
  },
});
```

### File Upload with Metadata

```typescript
// Upload with custom metadata
const result = await storage.write(fileBuffer, {
  filename: 'uploads/document.pdf',
  contentType: 'application/pdf',
});

// The service automatically sets:
// - Content-Type based on file extension or provided contentType
// - GZIP compression for eligible files
// - Proper metadata for file identification
```

### Stream Processing for Large Files

```typescript
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

async function processLargeFile(inputPath: string, outputKey: string) {
  // Upload large file as stream
  const inputStream = createReadStream(inputPath);
  const uploadResult = await storage.write(inputStream, {
    filename: outputKey,
  });

  console.log('Large file uploaded:', uploadResult.key);

  // Download large file as stream
  const downloadStream = await storage.read(outputKey);
  const outputStream = createWriteStream('downloaded-large-file');

  await pipeline(downloadStream, outputStream);
  console.log('Large file downloaded');
}

processLargeFile('large-video.mp4', 'videos/large-video.mp4');
```

### Error Handling

```typescript
import { StorageError, ErrorCode } from '@rytass/storages';

try {
  const result = await storage.read('non-existent-file.jpg');
} catch (error) {
  if (error instanceof StorageError && error.code === ErrorCode.READ_FILE_ERROR) {
    console.log('File not found');
  } else {
    console.error('Unexpected error:', error);
  }
}

// Safe file operations
async function safeFileOperation(key: string) {
  try {
    // Check if file exists first
    if (await storage.isExists(key)) {
      const content = await storage.read(key, { format: 'buffer' });
      return content;
    } else {
      console.log('File does not exist:', key);
      return null;
    }
  } catch (error) {
    console.error('Error reading file:', error);
    return null;
  }
}
```

## Integration Examples

### Express.js File Upload

```typescript
import express from 'express';
import multer from 'multer';
import { StorageGCSService } from '@rytass/storages-adapter-gcs';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const storage = new StorageGCSService({
  bucket: 'your-bucket',
  projectId: 'your-project',
  credentials: {
    client_email: process.env.GCS_CLIENT_EMAIL!,
    private_key: process.env.GCS_PRIVATE_KEY!,
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
    });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});
```

### NestJS Integration

```typescript
import { Injectable } from '@nestjs/common';
import { StorageGCSService } from '@rytass/storages-adapter-gcs';

@Injectable()
export class FileService {
  private storage: StorageGCSService;

  constructor() {
    this.storage = new StorageGCSService({
      bucket: process.env.GCS_BUCKET!,
      projectId: process.env.GCS_PROJECT_ID!,
      credentials: {
        client_email: process.env.GCS_CLIENT_EMAIL!,
        private_key: process.env.GCS_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      },
    });
  }

  async uploadFile(file: Buffer, filename: string): Promise<string> {
    const result = await this.storage.write(file, { filename });
    return this.storage.url(result.key);
  }

  async getFile(key: string): Promise<Buffer> {
    return this.storage.read(key, { format: 'buffer' });
  }

  async deleteFile(key: string): Promise<void> {
    await this.storage.remove(key);
  }

  async fileExists(key: string): Promise<boolean> {
    return this.storage.isExists(key);
  }
}
```

### Image Processing Pipeline

```typescript
import { StorageGCSService } from '@rytass/storages-adapter-gcs';
import { ConverterManager } from '@rytass/file-converter';
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';

class ImageProcessor {
  constructor(
    private storage: StorageGCSService,
    private converter: ConverterManager,
  ) {}

  async processAndUpload(
    imageBuffer: Buffer,
    sizes: { width: number; height: number; suffix: string }[],
  ): Promise<{ [key: string]: string }> {
    const results: { [key: string]: string } = {};

    for (const size of sizes) {
      // Create processor for this size
      const processor = new ConverterManager([
        new ImageResizer({
          maxWidth: size.width,
          maxHeight: size.height,
          keepAspectRatio: true,
        }),
        new ImageTranscoder({
          format: 'webp',
          quality: 85,
        }),
      ]);

      // Process image
      const processedImage = await processor.convert<Buffer>(imageBuffer);

      // Upload to GCS
      const uploadResult = await this.storage.write(processedImage, {
        filename: `images/processed-${size.suffix}.webp`,
        contentType: 'image/webp',
      });

      // Generate public URL
      results[size.suffix] = await this.storage.url(uploadResult.key);
    }

    return results;
  }
}

// Usage
const processor = new ImageProcessor(storage, converter);
const urls = await processor.processAndUpload(originalImage, [
  { width: 150, height: 150, suffix: 'thumbnail' },
  { width: 800, height: 600, suffix: 'medium' },
  { width: 1920, height: 1080, suffix: 'large' },
]);

console.log('Generated URLs:', urls);
```

## Configuration Options

### GCSOptions

| Option                     | Type     | Required | Description                      |
| -------------------------- | -------- | -------- | -------------------------------- |
| `bucket`                   | `string` | Yes      | Google Cloud Storage bucket name |
| `projectId`                | `string` | Yes      | Google Cloud Project ID          |
| `credentials`              | `object` | Yes      | Service account credentials      |
| `credentials.client_email` | `string` | Yes      | Service account email            |
| `credentials.private_key`  | `string` | Yes      | Service account private key      |

### WriteFileOptions

| Option        | Type     | Default        | Description                           |
| ------------- | -------- | -------------- | ------------------------------------- |
| `filename`    | `string` | auto-generated | Custom filename for the uploaded file |
| `contentType` | `string` | auto-detected  | MIME type of the file                 |

### ReadBufferFileOptions

| Option   | Type       | Default | Description           |
| -------- | ---------- | ------- | --------------------- |
| `format` | `'buffer'` | -       | Return file as Buffer |

### ReadStreamFileOptions

| Option   | Type       | Default | Description                    |
| -------- | ---------- | ------- | ------------------------------ |
| `format` | `'stream'` | -       | Return file as Readable stream |

## Best Practices

### Security

- Store service account credentials securely using environment variables
- Use IAM roles with minimal required permissions
- Regularly rotate service account keys
- Enable audit logging for storage access

### Performance

- Use streams for large files to reduce memory usage
- Leverage GZIP compression for text-based files
- Implement proper error handling and retry logic
- Use batch operations for multiple file uploads

### Cost Optimization

- Choose appropriate storage classes for your use case
- Set up lifecycle policies for automatic data management
- Monitor storage usage and optimize file sizes
- Use signed URLs to reduce bandwidth costs

### File Organization

- Use consistent naming conventions
- Organize files in logical folder structures
- Implement proper versioning strategies
- Consider using metadata for file categorization

## Error Handling

The adapter throws `StorageError` instances for various error conditions:

```typescript
import { StorageError, ErrorCode } from '@rytass/storages';

// Common error scenarios
try {
  await storage.read('non-existent-file.jpg');
} catch (error) {
  if (error instanceof StorageError) {
    switch (error.code) {
      case ErrorCode.READ_FILE_ERROR:
        console.log('File not found or inaccessible');
        break;
      default:
        console.log('Storage operation failed:', error.message);
    }
  }
}
```

## License

MIT
