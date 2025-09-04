# Rytass Utils - File Converter

A powerful and extensible file conversion framework that provides a unified interface for various file transformation operations. Features a pipeline-based architecture allowing multiple converters to be chained together for complex file processing workflows.

## Features

- [x] Pipeline-based conversion architecture
- [x] Support for Buffer and Stream inputs/outputs
- [x] Chainable converter operations
- [x] TypeScript type safety
- [x] Extensible converter interface
- [x] Async/await support
- [x] Memory-efficient stream processing

## Available Adapters

- **[@rytass/file-converter-adapter-image-resizer](https://www.npmjs.com/package/@rytass/file-converter-adapter-image-resizer)** - Image resizing with aspect ratio preservation
- **[@rytass/file-converter-adapter-image-transcoder](https://www.npmjs.com/package/@rytass/file-converter-adapter-image-transcoder)** - Image format conversion (JPEG, PNG, WebP, AVIF)
- **[@rytass/file-converter-adapter-image-watermark](https://www.npmjs.com/package/@rytass/file-converter-adapter-image-watermark)** - Watermark application with positioning control

## Installation

```bash
npm install @rytass/file-converter
# Install desired adapters
npm install @rytass/file-converter-adapter-image-resizer
npm install @rytass/file-converter-adapter-image-transcoder
npm install @rytass/file-converter-adapter-image-watermark
# or
yarn add @rytass/file-converter
```

## Basic Usage

### Single Converter

```typescript
import { ConverterManager } from '@rytass/file-converter';
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { readFileSync } from 'fs';

// Create a single converter
const resizer = new ImageResizer({
  maxWidth: 800,
  maxHeight: 600,
  keepAspectRatio: true,
});

// Convert a file
const originalImage = readFileSync('large-photo.jpg');
const resizedImage = await resizer.convert<Buffer>(originalImage);

// Save the result
writeFileSync('resized-photo.jpg', resizedImage);
```

### Pipeline Processing

```typescript
import { ConverterManager } from '@rytass/file-converter';
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';
import { ImageWatermark } from '@rytass/file-converter-adapter-image-watermark';

// Create converter pipeline
const manager = new ConverterManager([
  // Step 1: Resize image
  new ImageResizer({
    maxWidth: 1200,
    maxHeight: 800,
    keepAspectRatio: true,
  }),

  // Step 2: Add watermark
  new ImageWatermark({
    watermarkPath: './logo.png',
    position: 'bottom-right',
    opacity: 0.7,
    margin: 20,
  }),

  // Step 3: Convert to WebP
  new ImageTranscoder({
    format: 'webp',
    quality: 85,
  }),
]);

// Process image through pipeline
const originalImage = readFileSync('photo.jpg');
const processedImage = await manager.convert<Buffer>(originalImage);
writeFileSync('processed.webp', processedImage);
```

## Core Concepts

### FileConverter Interface

Every converter must implement the `FileConverter` interface:

```typescript
import { FileConverter, ConvertableFile } from '@rytass/file-converter';
import { Readable } from 'stream';

export class CustomConverter implements FileConverter {
  convert<T extends ConvertableFile>(file: ConvertableFile): Promise<T> {
    // Implementation
    return Promise.resolve(processedFile as T);
  }
}
```

### ConvertableFile Types

The framework supports two input/output types:

```typescript
type ConvertableFile = Buffer | Readable;

// Buffer - for small files or in-memory processing
const bufferFile: Buffer = readFileSync('file.jpg');

// Stream - for large files or memory-efficient processing
const streamFile: Readable = createReadStream('large-file.jpg');
```

### ConverterManager

The `ConverterManager` orchestrates multiple converters in a pipeline:

```typescript
class ConverterManager {
  constructor(converters: FileConverter[]);

  convert<T extends ConvertableFile>(file: ConvertableFile): Promise<T>;
}
```

## Advanced Usage

### Custom Converter Implementation

```typescript
import { FileConverter, ConvertableFile } from '@rytass/file-converter';
import { Readable } from 'stream';

interface CustomConverterOptions {
  // Define your options
  compressionLevel?: number;
  stripMetadata?: boolean;
}

export class CustomFileConverter implements FileConverter<CustomConverterOptions> {
  private options: CustomConverterOptions;

  constructor(options: CustomConverterOptions = {}) {
    this.options = {
      compressionLevel: 5,
      stripMetadata: false,
      ...options,
    };
  }

  async convert<T extends ConvertableFile>(file: ConvertableFile): Promise<T> {
    // Convert to Buffer for processing
    const buffer = await this.toBuffer(file);

    // Perform your conversion logic
    const processed = await this.processFile(buffer);

    // Return in requested format
    if (this.isStream(file)) {
      return Readable.from(processed) as T;
    }

    return processed as T;
  }

  private async toBuffer(file: ConvertableFile): Promise<Buffer> {
    if (Buffer.isBuffer(file)) {
      return file;
    }

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of file) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private isStream(file: ConvertableFile): boolean {
    return file instanceof Readable;
  }

  private async processFile(buffer: Buffer): Promise<Buffer> {
    // Your conversion logic here
    return buffer;
  }
}
```

### Stream Processing for Large Files

```typescript
import { ConverterManager } from '@rytass/file-converter';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const manager = new ConverterManager([
  new ImageResizer({ maxWidth: 1920, maxHeight: 1080 }),
  new ImageTranscoder({ format: 'jpeg', quality: 90 }),
]);

// Process large file with streams
async function processLargeFile(inputPath: string, outputPath: string) {
  const inputStream = createReadStream(inputPath);
  const outputStream = createWriteStream(outputPath);

  // Convert stream through pipeline
  const processedStream = await manager.convert<Readable>(inputStream);

  // Pipe to output
  await pipeline(processedStream, outputStream);

  console.log('Large file processed successfully');
}

processLargeFile('large-video-thumbnail.png', 'optimized.jpg');
```

### Conditional Pipeline

```typescript
import { ConverterManager, FileConverter } from '@rytass/file-converter';

function createImagePipeline(options: { resize?: boolean; watermark?: boolean; optimize?: boolean }): ConverterManager {
  const converters: FileConverter[] = [];

  if (options.resize) {
    converters.push(
      new ImageResizer({
        maxWidth: 1200,
        maxHeight: 800,
      }),
    );
  }

  if (options.watermark) {
    converters.push(
      new ImageWatermark({
        watermarkPath: './watermark.png',
        position: 'bottom-right',
      }),
    );
  }

  if (options.optimize) {
    converters.push(
      new ImageTranscoder({
        format: 'webp',
        quality: 85,
      }),
    );
  }

  return new ConverterManager(converters);
}

// Use conditional pipeline
const pipeline = createImagePipeline({
  resize: true,
  watermark: true,
  optimize: true,
});

const result = await pipeline.convert<Buffer>(imageBuffer);
```

### Error Handling

```typescript
import { ConverterManager } from '@rytass/file-converter';

class SafeConverterManager extends ConverterManager {
  async convert<T extends ConvertableFile>(file: ConvertableFile): Promise<T> {
    try {
      return await super.convert<T>(file);
    } catch (error) {
      console.error('Conversion failed:', error);

      // Implement fallback logic
      if (error.message.includes('unsupported format')) {
        // Return original file if format not supported
        return file as T;
      }

      throw error;
    }
  }
}

// Usage with error handling
const manager = new SafeConverterManager([new ImageResizer({ maxWidth: 800 })]);

try {
  const result = await manager.convert<Buffer>(inputFile);
  console.log('Conversion successful');
} catch (error) {
  console.error('Failed to convert file:', error.message);
  // Handle error appropriately
}
```

## Integration Examples

### Express.js File Upload

```typescript
import express from 'express';
import multer from 'multer';
import { ConverterManager } from '@rytass/file-converter';
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';

const app = express();
const upload = multer({ memory: true });

// Create conversion pipeline
const imageProcessor = new ConverterManager([
  new ImageResizer({ maxWidth: 1200, maxHeight: 800 }),
  new ImageTranscoder({ format: 'webp', quality: 85 }),
]);

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Process uploaded image
    const processedImage = await imageProcessor.convert<Buffer>(req.file.buffer);

    // Save to storage or return to client
    res.set('Content-Type', 'image/webp');
    res.send(processedImage);
  } catch (error) {
    res.status(500).json({ error: 'Image processing failed' });
  }
});
```

### NestJS Service

```typescript
import { Injectable } from '@nestjs/common';
import { ConverterManager } from '@rytass/file-converter';
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { ImageWatermark } from '@rytass/file-converter-adapter-image-watermark';

@Injectable()
export class ImageProcessingService {
  private thumbnailProcessor: ConverterManager;
  private fullSizeProcessor: ConverterManager;

  constructor() {
    // Thumbnail pipeline
    this.thumbnailProcessor = new ConverterManager([
      new ImageResizer({ maxWidth: 300, maxHeight: 300 }),
      new ImageTranscoder({ format: 'jpeg', quality: 80 }),
    ]);

    // Full-size pipeline
    this.fullSizeProcessor = new ConverterManager([
      new ImageResizer({ maxWidth: 1920, maxHeight: 1080 }),
      new ImageWatermark({
        watermarkPath: './assets/watermark.png',
        position: 'bottom-right',
        opacity: 0.5,
      }),
      new ImageTranscoder({ format: 'webp', quality: 90 }),
    ]);
  }

  async createThumbnail(imageBuffer: Buffer): Promise<Buffer> {
    return this.thumbnailProcessor.convert<Buffer>(imageBuffer);
  }

  async processFullSize(imageBuffer: Buffer): Promise<Buffer> {
    return this.fullSizeProcessor.convert<Buffer>(imageBuffer);
  }

  async processImage(imageBuffer: Buffer): Promise<{
    thumbnail: Buffer;
    fullSize: Buffer;
  }> {
    const [thumbnail, fullSize] = await Promise.all([
      this.createThumbnail(imageBuffer),
      this.processFullSize(imageBuffer),
    ]);

    return { thumbnail, fullSize };
  }
}
```

### Batch Processing

```typescript
import { ConverterManager } from '@rytass/file-converter';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

class BatchImageProcessor {
  constructor(private manager: ConverterManager) {}

  async processDirectory(
    inputDir: string,
    outputDir: string,
    options: {
      extensions?: string[];
      parallel?: number;
    } = {},
  ) {
    const { extensions = ['.jpg', '.png'], parallel = 5 } = options;

    // Get all image files
    const files = await readdir(inputDir);
    const imageFiles = files.filter(file => extensions.some(ext => file.toLowerCase().endsWith(ext)));

    // Process in batches
    const results = [];
    for (let i = 0; i < imageFiles.length; i += parallel) {
      const batch = imageFiles.slice(i, i + parallel);

      const batchResults = await Promise.all(
        batch.map(async filename => {
          try {
            const inputPath = join(inputDir, filename);
            const outputPath = join(outputDir, this.getOutputName(filename));

            const inputBuffer = await readFile(inputPath);
            const outputBuffer = await this.manager.convert<Buffer>(inputBuffer);

            await writeFile(outputPath, outputBuffer);

            return { filename, success: true };
          } catch (error) {
            return { filename, success: false, error: error.message };
          }
        }),
      );

      results.push(...batchResults);

      console.log(`Processed batch ${i / parallel + 1} of ${Math.ceil(imageFiles.length / parallel)}`);
    }

    return results;
  }

  private getOutputName(filename: string): string {
    const parts = filename.split('.');
    parts[parts.length - 1] = 'webp'; // Change extension
    return parts.join('.');
  }
}

// Usage
const batchProcessor = new BatchImageProcessor(
  new ConverterManager([new ImageResizer({ maxWidth: 1200 }), new ImageTranscoder({ format: 'webp' })]),
);

const results = await batchProcessor.processDirectory('./input-images', './output-images', { parallel: 10 });

console.log(`Processed ${results.filter(r => r.success).length} files successfully`);
```

### Storage Integration

```typescript
import { ConverterManager } from '@rytass/file-converter';
import { StorageS3Service } from '@rytass/storages-adapter-s3';

class ImageUploadService {
  constructor(
    private processor: ConverterManager,
    private storage: StorageS3Service,
  ) {}

  async uploadAndProcess(
    file: Buffer,
    key: string,
    options: {
      generateThumbnail?: boolean;
      metadata?: Record<string, string>;
    } = {},
  ): Promise<{ url: string; thumbnailUrl?: string }> {
    // Process main image
    const processedImage = await this.processor.convert<Buffer>(file);

    // Upload main image
    const mainKey = `images/${key}`;
    await this.storage.write(processedImage, mainKey, {
      contentType: 'image/webp',
      metadata: options.metadata,
    });

    const result: { url: string; thumbnailUrl?: string } = {
      url: await this.storage.url(mainKey),
    };

    // Generate thumbnail if requested
    if (options.generateThumbnail) {
      const thumbnailProcessor = new ConverterManager([new ImageResizer({ maxWidth: 200, maxHeight: 200 })]);

      const thumbnail = await thumbnailProcessor.convert<Buffer>(file);
      const thumbnailKey = `thumbnails/${key}`;

      await this.storage.write(thumbnail, thumbnailKey, {
        contentType: 'image/webp',
      });

      result.thumbnailUrl = await this.storage.url(thumbnailKey);
    }

    return result;
  }
}
```

## Performance Optimization

### Memory Management

```typescript
import { ConverterManager, ConvertableFile } from '@rytass/file-converter';
import { Readable } from 'stream';

class MemoryEfficientConverter {
  constructor(private manager: ConverterManager) {}

  async convertLargeFile(inputPath: string, outputPath: string): Promise<void> {
    // Use streams for large files
    const inputStream = createReadStream(inputPath);
    const outputStream = createWriteStream(outputPath);

    try {
      // Process as stream to avoid loading entire file in memory
      const processedStream = await this.manager.convert<Readable>(inputStream);

      await pipeline(processedStream, outputStream);
    } finally {
      // Clean up streams
      inputStream.destroy();
      outputStream.destroy();
    }
  }

  // Batch processing with memory limits
  async processBatch(files: string[], maxConcurrent: number = 3): Promise<void> {
    const queue = [...files];
    const processing = new Set<Promise<void>>();

    while (queue.length > 0 || processing.size > 0) {
      // Start new tasks up to limit
      while (processing.size < maxConcurrent && queue.length > 0) {
        const file = queue.shift()!;
        const task = this.processFile(file).finally(() => {
          processing.delete(task);
        });
        processing.add(task);
      }

      // Wait for at least one to complete
      if (processing.size > 0) {
        await Promise.race(processing);
      }
    }
  }

  private async processFile(filePath: string): Promise<void> {
    // Process individual file
  }
}
```

### Caching Converted Files

```typescript
import { ConverterManager } from '@rytass/file-converter';
import * as crypto from 'crypto';

class CachedConverter {
  private cache = new Map<string, Buffer>();

  constructor(
    private manager: ConverterManager,
    private maxCacheSize: number = 100,
  ) {}

  async convert(file: Buffer, cacheKey?: string): Promise<Buffer> {
    // Generate cache key if not provided
    const key = cacheKey || this.generateKey(file);

    // Check cache
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // Convert file
    const result = await this.manager.convert<Buffer>(file);

    // Add to cache (with size limit)
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, result);

    return result;
  }

  private generateKey(file: Buffer): string {
    return crypto.createHash('md5').update(file).digest('hex');
  }

  clearCache(): void {
    this.cache.clear();
  }
}
```

## Testing

### Unit Testing

```typescript
import { ConverterManager } from '@rytass/file-converter';
import { FileConverter, ConvertableFile } from '@rytass/file-converter';

// Mock converter for testing
class MockConverter implements FileConverter {
  async convert<T extends ConvertableFile>(file: ConvertableFile): Promise<T> {
    // Simple mock that adds a marker to buffer
    const buffer = Buffer.isBuffer(file) ? file : await this.streamToBuffer(file);
    const marked = Buffer.concat([Buffer.from('MOCK:'), buffer]);
    return marked as T;
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}

describe('ConverterManager', () => {
  it('should chain converters in sequence', async () => {
    const manager = new ConverterManager([new MockConverter(), new MockConverter()]);

    const input = Buffer.from('test');
    const result = await manager.convert<Buffer>(input);

    expect(result.toString()).toBe('MOCK:MOCK:test');
  });

  it('should handle stream input and output', async () => {
    const manager = new ConverterManager([new MockConverter()]);

    const input = Readable.from(Buffer.from('stream-test'));
    const result = await manager.convert<Readable>(input);

    const buffer = await streamToBuffer(result);
    expect(buffer.toString()).toBe('MOCK:stream-test');
  });
});
```

### Integration Testing

```typescript
import { ConverterManager } from '@rytass/file-converter';
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { readFileSync } from 'fs';
import sharp from 'sharp';

describe('Image Processing Pipeline', () => {
  it('should resize image correctly', async () => {
    const manager = new ConverterManager([new ImageResizer({ maxWidth: 100, maxHeight: 100 })]);

    const testImage = createTestImage(200, 200);
    const result = await manager.convert<Buffer>(testImage);

    const metadata = await sharp(result).metadata();
    expect(metadata.width).toBeLessThanOrEqual(100);
    expect(metadata.height).toBeLessThanOrEqual(100);
  });
});

function createTestImage(width: number, height: number): Buffer {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .jpeg()
    .toBuffer();
}
```

## Best Practices

### Converter Design

- Keep converters focused on a single transformation
- Make converters configurable through options
- Support both Buffer and Stream inputs/outputs
- Implement proper error handling and validation

### Pipeline Composition

- Order converters from most destructive to least
- Consider memory usage when chaining converters
- Use streams for large file processing
- Implement progress tracking for long operations

### Error Handling

- Validate input files before processing
- Provide meaningful error messages
- Implement fallback strategies
- Log conversion failures for debugging

### Performance

- Use streams for files larger than 10MB
- Implement caching for frequently converted files
- Process files in parallel when possible
- Monitor memory usage in production

## License

MIT
