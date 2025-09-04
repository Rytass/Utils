# Rytass Utils - Cloudflare R2 Storage Adapter

High-performance storage adapter for Cloudflare R2, providing S3-compatible object storage with global distribution and zero egress fees. Offers the same interface as other storage adapters in the Rytass ecosystem.

## Features

- [x] Cloudflare R2 object storage integration
- [x] S3-compatible API interface
- [x] Zero egress fees for data retrieval
- [x] Global edge distribution
- [x] Buffer and Stream file operations
- [x] Pre-signed URL generation
- [x] File existence checking and deletion
- [x] Cost-effective storage solution
- [x] High availability and durability

## Installation

```bash
npm install @rytass/storages-adapter-r2
# or
yarn add @rytass/storages-adapter-r2
```

## Configuration

### StorageR2Options

| Property    | Type     | Required | Description               |
| ----------- | -------- | -------- | ------------------------- |
| `bucket`    | `string` | Yes      | R2 bucket name            |
| `accessKey` | `string` | Yes      | R2 Access Key ID          |
| `secretKey` | `string` | Yes      | R2 Secret Access Key      |
| `accountId` | `string` | Yes      | Cloudflare Account ID     |
| `region`    | `string` | No       | R2 region (default: auto) |

## Usage

### Basic Setup

```typescript
import { StorageR2Service } from '@rytass/storages-adapter-r2';

const storage = new StorageR2Service({
  bucket: 'my-r2-bucket',
  accessKey: 'your-access-key',
  secretKey: 'your-secret-key',
  accountId: 'your-cloudflare-account-id',
});
```

### File Operations

```typescript
import { readFileSync } from 'fs';

// Upload file
const fileBuffer = readFileSync('document.pdf');
const result = await storage.write(fileBuffer, 'documents/important-doc.pdf', {
  contentType: 'application/pdf',
  metadata: {
    uploadedBy: 'user123',
    department: 'legal',
  },
});

// Download file as buffer
const downloadedFile = await storage.read('documents/important-doc.pdf', {
  format: 'buffer',
});

// Download file as stream (default)
const fileStream = await storage.read('documents/important-doc.pdf');

// Generate public URL
const publicUrl = await storage.url('documents/important-doc.pdf');

// Check if file exists
const exists = await storage.exists('documents/important-doc.pdf');

// Delete file
await storage.delete('documents/important-doc.pdf');
```

### Stream Processing

```typescript
import { createReadStream } from 'fs';

// Upload large file via stream
const fileStream = createReadStream('large-video.mp4');
const uploadResult = await storage.write(fileStream, 'media/videos/large-video.mp4', {
  contentType: 'video/mp4',
});
```

### Integration with File Converter

```typescript
import { ConverterManager } from '@rytass/file-converter';
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { StorageR2Service } from '@rytass/storages-adapter-r2';

const storage = new StorageR2Service({
  bucket: 'my-images',
  accessKey: process.env.R2_ACCESS_KEY!,
  secretKey: process.env.R2_SECRET_KEY!,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
});

const manager = new ConverterManager(
  [
    new ImageResizer({
      maxWidth: 1200,
      maxHeight: 800,
      keepAspectRatio: true,
    }),
  ],
  storage,
);

const result = await manager.save(imageFile, 'processed-images/', 'thumbnail.jpg');
```

## Environment Variables

```bash
# .env
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
CLOUDFLARE_ACCOUNT_ID=your_account_id
R2_BUCKET_NAME=your-bucket-name
```

```typescript
const storage = new StorageR2Service({
  bucket: process.env.R2_BUCKET_NAME!,
  accessKey: process.env.R2_ACCESS_KEY_ID!,
  secretKey: process.env.R2_SECRET_ACCESS_KEY!,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
});
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
        console.error('Access denied - check R2 credentials');
        break;
      case ErrorCode.QUOTA_EXCEEDED:
        console.error('Storage quota exceeded');
        break;
      default:
        console.error('Storage error:', error.message);
    }
  }
}
```

## R2 vs S3 Comparison

| Feature             | Cloudflare R2      | Amazon S3           |
| ------------------- | ------------------ | ------------------- |
| Egress Fees         | **$0**             | Charged per GB      |
| Global Distribution | Built-in           | CloudFront required |
| API Compatibility   | S3-compatible      | Native              |
| Pricing Model       | Simple             | Complex tiers       |
| Edge Computing      | Cloudflare Workers | Lambda@Edge         |

## Best Practices

### Cost Optimization

- Leverage zero egress fees for frequently accessed content
- Use R2 for serving static assets globally
- Consider R2 for backup storage with frequent retrievals

### Performance

- Utilize Cloudflare's global network for faster access
- Implement caching strategies at the edge
- Use appropriate Content-Type headers for better caching

### Security

- Use IAM tokens with minimal required permissions
- Enable bucket-level security policies
- Implement proper access logging

## Cloudflare R2 Setup

1. **Create R2 Bucket:**

   ```bash
   # Via Cloudflare Dashboard or API
   curl -X POST "https://api.cloudflare.com/client/v4/accounts/{account-id}/r2/buckets" \
     -H "Authorization: Bearer {api-token}" \
     -H "Content-Type: application/json" \
     --data '{"name":"my-bucket"}'
   ```

2. **Generate API Tokens:**
   - Go to Cloudflare Dashboard → R2 → Manage R2 API tokens
   - Create token with appropriate permissions

3. **Configure CORS (if needed):**
   ```json
   {
     "allowed_origins": ["https://yourdomain.com"],
     "allowed_methods": ["GET", "PUT", "POST", "DELETE"],
     "allowed_headers": ["*"],
     "expose_headers": ["ETag"],
     "max_age": 3600
   }
   ```

## Migration from S3

```typescript
// Minimal code changes required due to S3-compatible interface
const storageR2 = new StorageR2Service({
  // R2 configuration
});

const storageS3 = new StorageS3Service({
  // S3 configuration
});

// Same interface, different storage backend
const operations = [
  storage.write(file, key),
  storage.read(key),
  storage.delete(key),
  storage.exists(key),
  storage.url(key),
];
```

## License

MIT
