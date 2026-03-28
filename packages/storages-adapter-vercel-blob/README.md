# @rytass/storages-adapter-vercel-blob

Vercel Blob storage adapter for `@rytass/storages`.

## Installation

```bash
npm install @rytass/storages-adapter-vercel-blob
# or
yarn add @rytass/storages-adapter-vercel-blob
```

## Usage

```typescript
import { StorageVercelBlobService } from '@rytass/storages-adapter-vercel-blob';

const storage = new StorageVercelBlobService({
  token: 'your-blob-read-write-token', // or set BLOB_READ_WRITE_TOKEN env var
  pathPrefix: 'uploads', // optional, default: 'uploads'
});

// Write a file
const { key } = await storage.write(buffer);

// Write with custom filename
const { key } = await storage.write(buffer, { filename: 'my-file.png' });

// Read as buffer
const buffer = await storage.read(key, { format: 'buffer' });

// Read as stream
const stream = await storage.read(key);

// Get file URL
const url = await storage.url(key);

// Check existence
const exists = await storage.isExists(key);

// Remove file
await storage.remove(key);

// Batch write
const results = await storage.batchWrite([buffer1, buffer2]);
```

## Options

| Option       | Type       | Default                          | Description                     |
|--------------|------------|----------------------------------|---------------------------------|
| `token`      | `string`   | `process.env.BLOB_READ_WRITE_TOKEN` | Vercel Blob read-write token |
| `pathPrefix` | `string`   | `'uploads'`                      | Path prefix for stored files    |
| `access`     | `'public'` | `'public'`                       | Blob access level               |
