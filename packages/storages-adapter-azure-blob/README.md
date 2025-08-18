# Rytass Utils - Azure Blob Storage Adapter

A powerful Azure Blob Storage adapter for the Rytass file storage system. Provides seamless integration with Azure Blob Storage containers with support for SAS URLs, stream processing, and automatic file type detection.

## Features

- [x] Azure Blob Storage container integration
- [x] SAS URL generation for secure file access
- [x] Buffer and Stream file operations
- [x] Automatic content type detection
- [x] Batch file operations
- [x] File existence checking
- [x] Connection string authentication
- [x] Block blob support
- [x] TypeScript support

## Installation

```bash
npm install @rytass/storages-adapter-azure-blob @azure/storage-blob
# or
yarn add @rytass/storages-adapter-azure-blob @azure/storage-blob
```

## Basic Usage

### Service Configuration

```typescript
import { StorageAzureBlobService } from '@rytass/storages-adapter-azure-blob';

const storage = new StorageAzureBlobService({
  connectionString: 'DefaultEndpointsProtocol=https;AccountName=youraccount;AccountKey=yourkey;EndpointSuffix=core.windows.net',
  container: 'your-container-name'
});
```

### Upload Files

```typescript
import { readFileSync, createReadStream } from 'fs';

// Upload buffer
const imageBuffer = readFileSync('photo.jpg');
const result = await storage.write(imageBuffer, {
  filename: 'uploads/photo.jpg',
  contentType: 'image/jpeg'
});
console.log('Uploaded:', result.key);

// Upload stream
const fileStream = createReadStream('document.pdf');
const streamResult = await storage.write(fileStream, {
  filename: 'documents/document.pdf',
  contentType: 'application/pdf'
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

### Generate SAS URLs

```typescript
// Default expiration (24 hours)
const url = await storage.url('uploads/photo.jpg');
console.log('SAS URL:', url);

// Custom expiration (1 hour from now)
const customUrl = await storage.url(
  'uploads/photo.jpg',
  Date.now() + 1000 * 60 * 60
);
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
const files = [
  readFileSync('file1.jpg'),
  readFileSync('file2.png'),
  createReadStream('file3.pdf')
];

const batchResults = await storage.batchWrite(files);
batchResults.forEach(result => {
  console.log('Uploaded:', result.key);
});
```

## Advanced Usage

### Environment-based Configuration

```typescript
// .env file
// AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
// AZURE_STORAGE_CONTAINER=your-container-name

import { StorageAzureBlobService } from '@rytass/storages-adapter-azure-blob';

const storage = new StorageAzureBlobService({
  connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
  container: process.env.AZURE_STORAGE_CONTAINER!
});
```

### Connection String Formats

```typescript
// Using account name and key
const storage1 = new StorageAzureBlobService({
  connectionString: 'DefaultEndpointsProtocol=https;AccountName=mystorageaccount;AccountKey=myaccountkey;EndpointSuffix=core.windows.net',
  container: 'mycontainer'
});

// Using SAS token
const storage2 = new StorageAzureBlobService({
  connectionString: 'BlobEndpoint=https://mystorageaccount.blob.core.windows.net/;SharedAccessSignature=sv=2020-08-04&ss=b&srt=sco&sp=rwdlacx&se=2024-12-31T23:59:59Z&st=2024-01-01T00:00:00Z&spr=https,http&sig=...',
  container: 'mycontainer'
});

// Using connection string from Azure portal
const storage3 = new StorageAzureBlobService({
  connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
  container: 'uploads'
});
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
import { StorageAzureBlobService } from '@rytass/storages-adapter-azure-blob';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const storage = new StorageAzureBlobService({
  connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
  container: 'uploads'
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await storage.write(req.file.buffer, {
      filename: `uploads/${Date.now()}-${req.file.originalname}`,
      contentType: req.file.mimetype
    });

    const publicUrl = await storage.url(result.key);

    res.json({
      success: true,
      key: result.key,
      url: publicUrl
    });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});
```

### NestJS Integration

```typescript
import { Injectable } from '@nestjs/common';
import { StorageAzureBlobService } from '@rytass/storages-adapter-azure-blob';

@Injectable()
export class FileService {
  private storage: StorageAzureBlobService;

  constructor() {
    this.storage = new StorageAzureBlobService({
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
      container: process.env.AZURE_STORAGE_CONTAINER!
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

## Configuration Options

### AzureBlobOptions

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `connectionString` | `string` | Yes | Azure Storage connection string |
| `container` | `string` | Yes | Blob container name |

### WriteFileOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filename` | `string` | auto-generated | Custom filename for the uploaded file |
| `contentType` | `string` | auto-detected | MIME type of the file |

### ReadBufferFileOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | `'buffer'` | - | Return file as Buffer |

### ReadStreamFileOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | `'stream'` | - | Return file as Readable stream |

## Best Practices

### Security
- Store connection strings securely using environment variables or Azure Key Vault
- Use managed identities when running on Azure
- Implement proper access policies and SAS token restrictions
- Enable audit logging for storage access

### Performance
- Use streams for large files to reduce memory usage
- Implement proper retry logic for transient failures
- Use appropriate blob access tiers for your use case
- Consider using Azure CDN for frequently accessed files

### Cost Optimization
- Choose appropriate blob access tiers (Hot, Cool, Archive)
- Set up lifecycle management policies
- Monitor storage usage and optimize file sizes
- Use SAS URLs to reduce bandwidth costs

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