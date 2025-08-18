# Rytass Utils - AWS S3 Storage Adapter

Unified interface implementation for Amazon S3 cloud storage service, providing complete file upload, download, and management functionality. Supports multiple authentication methods, multipart uploads, pre-signed URLs, and other enterprise-grade features.

## Features

- [x] AWS S3 storage service integration
- [x] Buffer and Stream file operations support
- [x] Pre-signed URL generation
- [x] Multipart upload support (for large files)
- [x] File existence checking
- [x] File deletion functionality
- [x] IAM role and access key authentication support
- [x] Configurable S3 region settings
- [x] Error handling and retry mechanisms

## Installation

```bash
npm install @rytass/storages-adapter-s3
# or
yarn add @rytass/storages-adapter-s3
```

## Configuration

### StorageS3Options

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `bucket` | `string` | Yes | S3 bucket name |
| `accessKey` | `string` | Yes | AWS Access Key ID |
| `secretKey` | `string` | Yes | AWS Secret Access Key |
| `region` | `string` | Yes | AWS region (e.g., ap-northeast-1) |

## Usage

### Basic Setup

```typescript
import { StorageS3Service } from '@rytass/storages-adapter-s3';

const storage = new StorageS3Service({
  bucket: 'my-app-storage',
  accessKey: 'AKIAIOSFODNN7EXAMPLE',
  secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'ap-northeast-1'
});
```

### File Upload

```typescript
import { readFileSync } from 'fs';

// Upload from Buffer
const fileBuffer = readFileSync('document.pdf');
const uploadResult = await storage.write(
  fileBuffer,
  'documents/user-123/document.pdf',
  {
    contentType: 'application/pdf'
  }
);

console.log('File uploaded:', uploadResult.url);
```

### Stream Upload for Large Files

```typescript
import { createReadStream } from 'fs';

// Upload from Stream (recommended for large files)
const fileStream = createReadStream('video.mp4');
const result = await storage.write(
  fileStream,
  'videos/user-123/video.mp4',
  {
    contentType: 'video/mp4'
  }
);
```

### File Download

```typescript
// Download as Buffer
const fileBuffer = await storage.read('documents/user-123/document.pdf', {
  format: 'buffer'
});

// Download as Stream  
const fileStream = await storage.read('documents/user-123/document.pdf', {
  format: 'stream'
});

// Download as Stream (default)
const fileStream2 = await storage.read('documents/user-123/document.pdf');
fileStream.pipe(process.stdout);
```

### Generate Signed URLs

```typescript
// Generate a signed URL valid for 1 hour
const signedUrl = await storage.url('documents/user-123/document.pdf');
console.log('Download URL:', signedUrl);

// URL expires automatically for security
```

### File Management

```typescript
// Check if file exists
const exists = await storage.exists('documents/user-123/document.pdf');
console.log('File exists:', exists);

// Delete file
await storage.delete('documents/user-123/document.pdf');
console.log('File deleted successfully');
```

### Batch Operations

```typescript
// Upload multiple files
const files = [
  { buffer: file1Buffer, key: 'images/image1.jpg' },
  { buffer: file2Buffer, key: 'images/image2.jpg' },
  { buffer: file3Buffer, key: 'images/image3.jpg' }
];

const results = await Promise.all(
  files.map(({ buffer, key }) => 
    storage.write(buffer, key, { contentType: 'image/jpeg' })
  )
);

console.log('All files uploaded:', results.length);
```

## Integration with File Converter

```typescript
import { ConverterManager } from '@rytass/file-converter';
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { StorageS3Service } from '@rytass/storages-adapter-s3';
import { readFileSync } from 'fs';

// Setup storage
const storage = new StorageS3Service({
  bucket: 'my-images',
  accessKey: process.env.AWS_ACCESS_KEY!,
  secretKey: process.env.AWS_SECRET_KEY!,
  region: 'ap-northeast-1'
});

// Setup converter
const manager = new ConverterManager([
  new ImageResizer({
    maxWidth: 1200,
    maxHeight: 800,
    keepAspectRatio: true
  })
]);

// Process image and upload to storage
const imageFile = readFileSync('large-image.jpg');
const processedImage = await manager.convert<Buffer>(imageFile);

const result = await storage.write(
  processedImage,
  'processed-images/thumbnail.jpg',
  { contentType: 'image/jpeg' }
);

console.log('Processed image uploaded:', result.key);
console.log('Access URL:', await storage.url(result.key));
```

## Error Handling

```typescript
import { StorageError, ErrorCode } from '@rytass/storages';

try {
  const result = await storage.write(fileBuffer, 'path/to/file.pdf');
} catch (error) {
  if (error instanceof StorageError) {
    switch (error.code) {
      case ErrorCode.FILE_NOT_FOUND:
        console.error('File not found');
        break;
      case ErrorCode.PERMISSION_DENIED:
        console.error('Access denied - check AWS credentials');
        break;
      case ErrorCode.INVALID_KEY:
        console.error('Invalid file key or bucket name');
        break;
      default:
        console.error('Storage error:', error.message);
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Best Practices

### Security
- Use IAM roles instead of hardcoded access keys
- Set up appropriate bucket policies
- Use pre-signed URLs for temporary access permissions

### Performance
- Use stream upload for large files
- Set appropriate Content-Type headers
- Consider enabling S3 Transfer Acceleration

### Cost Optimization
- Use appropriate storage classes (Standard, IA, Glacier)
- Set up lifecycle policies to automatically transition old files
- Monitor data transfer costs

## Environment Variables

```bash
# .env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_DEFAULT_REGION=ap-northeast-1
S3_BUCKET_NAME=your-bucket-name
```

```typescript
// Using environment variables
const storage = new StorageS3Service({
  bucket: process.env.S3_BUCKET_NAME!,
  accessKey: process.env.AWS_ACCESS_KEY_ID!,
  secretKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
});
```

## AWS IAM Policy Example

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:GetObjectVersion"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name"
    }
  ]
}
```

## License

MIT