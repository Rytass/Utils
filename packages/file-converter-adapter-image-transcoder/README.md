# Rytass Utils - File Converter Image Transcoder Adapter

A powerful image format conversion adapter for the Rytass file converter framework. Built on top of Sharp, this adapter provides high-performance image format transcoding with support for modern formats including WebP, AVIF, and HEIF.

## Features

- [x] Modern image format support (WebP, AVIF, HEIF)
- [x] Traditional format conversion (JPEG, PNG, GIF, TIFF)
- [x] High-performance Sharp integration
- [x] Configurable quality settings per format
- [x] Progressive JPEG support
- [x] Lossless and lossy compression options
- [x] SVG input support
- [x] Buffer and Stream processing
- [x] Concurrency control
- [x] TypeScript type safety

## Supported Formats

### Input Formats
- JPEG (jpg, jpeg)
- PNG
- WebP
- GIF
- AVIF
- TIFF (tif, tiff)
- SVG

### Output Formats
- **JPEG** - Universal compatibility with quality control
- **PNG** - Lossless compression with transparency
- **WebP** - Modern format with superior compression
- **AVIF** - Next-generation format with excellent compression
- **HEIF** - Apple's preferred format for photos
- **GIF** - Animated image support
- **TIFF** - Professional photography and print

## Installation

```bash
npm install @rytass/file-converter-adapter-image-transcoder
# or
yarn add @rytass/file-converter-adapter-image-transcoder
```

**Peer Dependencies:**
```bash
npm install @rytass/file-converter sharp
```

## Basic Usage

### JPEG to WebP Conversion

```typescript
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';
import { readFileSync, writeFileSync } from 'fs';

// Create transcoder for WebP output
const transcoder = new ImageTranscoder({
  targetFormat: 'webp',
  quality: 85,
  effort: 4 // WebP compression effort (0-6)
});

// Convert image
const jpegBuffer = readFileSync('photo.jpg');
const webpBuffer = await transcoder.convert<Buffer>(jpegBuffer);
writeFileSync('photo.webp', webpBuffer);
```

### PNG to AVIF with Quality Control

```typescript
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';

const transcoder = new ImageTranscoder({
  targetFormat: 'avif',
  quality: 80,
  effort: 4,
  chromaSubsampling: '4:4:4' // Preserve color quality
});

const pngBuffer = readFileSync('image.png');
const avifBuffer = await transcoder.convert<Buffer>(pngBuffer);
```

### Batch Format Conversion

```typescript
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';
import { ConverterManager } from '@rytass/file-converter';

// Create transcoders for different formats
const webpTranscoder = new ImageTranscoder({
  targetFormat: 'webp',
  quality: 85
});

const avifTranscoder = new ImageTranscoder({
  targetFormat: 'avif',
  quality: 80
});

const jpegTranscoder = new ImageTranscoder({
  targetFormat: 'jpeg',
  quality: 90,
  progressive: true
});

// Convert to multiple formats
async function convertToMultipleFormats(inputBuffer: Buffer) {
  const [webp, avif, jpeg] = await Promise.all([
    webpTranscoder.convert<Buffer>(inputBuffer),
    avifTranscoder.convert<Buffer>(inputBuffer),
    jpegTranscoder.convert<Buffer>(inputBuffer)
  ]);

  return { webp, avif, jpeg };
}
```

## Format-Specific Configuration

### WebP Options

```typescript
const webpTranscoder = new ImageTranscoder({
  targetFormat: 'webp',
  quality: 85,           // Quality 0-100
  alphaQuality: 90,      // Alpha channel quality
  lossless: false,       // Use lossless compression
  nearLossless: false,   // Use near-lossless compression
  smartSubsample: true,  // Use smart subsampling
  effort: 4             // Compression effort 0-6 (higher = better compression)
});
```

### AVIF Options

```typescript
const avifTranscoder = new ImageTranscoder({
  targetFormat: 'avif',
  quality: 80,                    // Quality 1-100
  lossless: false,               // Use lossless compression
  effort: 4,                     // Compression effort 0-9
  chromaSubsampling: '4:4:4',    // Color subsampling
  bitdepth: 8                    // Bit depth 8, 10, or 12
});
```

### JPEG Options

```typescript
const jpegTranscoder = new ImageTranscoder({
  targetFormat: 'jpeg',
  quality: 90,              // Quality 1-100
  progressive: true,        // Progressive JPEG
  mozjpeg: false,          // Use mozjpeg encoder
  trellisQuantisation: false, // Enable trellis quantisation
  overshootDeringing: false,  // Enable overshoot deringing
  optimiseScans: false      // Optimize progressive scans
});
```

### PNG Options

```typescript
const pngTranscoder = new ImageTranscoder({
  targetFormat: 'png',
  progressive: false,       // Progressive PNG
  compressionLevel: 9,      // Compression level 0-9
  adaptiveFiltering: false, // Adaptive filtering
  palette: false,          // Use palette
  quality: 100,            // Quality 0-100 (for palette)
  effort: 7               // Compression effort 1-10
});
```

### HEIF Options

```typescript
const heifTranscoder = new ImageTranscoder({
  targetFormat: 'heif',
  quality: 85,        // Quality 1-100
  compression: 'av1', // Compression: 'av1' or 'hevc'
  effort: 4,          // Compression effort 0-9
  lossless: false     // Use lossless compression
});
```

### GIF Options

```typescript
const gifTranscoder = new ImageTranscoder({
  targetFormat: 'gif',
  colours: 256,       // Number of colors in palette
  effort: 7,          // Quantization effort 1-10
  dither: 1.0        // Dithering level 0-1
});
```

### TIFF Options

```typescript
const tiffTranscoder = new ImageTranscoder({
  targetFormat: 'tiff',
  quality: 90,              // Quality for JPEG compression
  compression: 'jpeg',      // Compression: 'lzw', 'deflate', 'jpeg', 'ccittfax4'
  predictor: 'horizontal',  // Predictor for lzw/deflate
  tile: false,             // Use tiled format
  tileWidth: 256,          // Tile width
  tileHeight: 256,         // Tile height
  xres: 300,               // Horizontal resolution
  yres: 300                // Vertical resolution
});
```

## Advanced Usage

### Pipeline Integration

```typescript
import { ConverterManager } from '@rytass/file-converter';
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';

// Create processing pipeline
const pipeline = new ConverterManager([
  // Step 1: Resize image
  new ImageResizer({
    maxWidth: 1920,
    maxHeight: 1080,
    keepAspectRatio: true
  }),
  
  // Step 2: Convert to modern format
  new ImageTranscoder({
    targetFormat: 'avif',
    quality: 80,
    effort: 6
  })
]);

// Process image through pipeline
const originalImage = readFileSync('large-photo.jpg');
const optimizedImage = await pipeline.convert<Buffer>(originalImage);
writeFileSync('optimized.avif', optimizedImage);
```

### Stream Processing for Large Files

```typescript
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const transcoder = new ImageTranscoder({
  targetFormat: 'webp',
  quality: 85
});

// Process large files with streams
async function transcodeStream(inputPath: string, outputPath: string) {
  const inputStream = createReadStream(inputPath);
  const outputStream = createWriteStream(outputPath);
  
  const processedStream = await transcoder.convert<Readable>(inputStream);
  
  await pipeline(processedStream, outputStream);
  console.log('Stream transcoding completed');
}

await transcodeStream('large-image.tiff', 'compressed.webp');
```

### Performance Optimization

```typescript
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';

// Configure for high-performance processing
const transcoder = new ImageTranscoder({
  targetFormat: 'webp',
  quality: 85,
  effort: 2,        // Lower effort for faster processing
  concurrency: 4    // Process multiple images simultaneously
});

// Batch processing with concurrency control
class BatchTranscoder {
  constructor(private transcoder: ImageTranscoder) {}

  async processBatch(
    files: Buffer[],
    maxConcurrent: number = 4
  ): Promise<Buffer[]> {
    const results: Buffer[] = [];
    
    for (let i = 0; i < files.length; i += maxConcurrent) {
      const batch = files.slice(i, i + maxConcurrent);
      
      const batchResults = await Promise.all(
        batch.map(file => this.transcoder.convert<Buffer>(file))
      );
      
      results.push(...batchResults);
    }
    
    return results;
  }
}
```

### Format Detection and Auto-Conversion

```typescript
import { fromBuffer } from 'file-type';

async function smartTranscode(
  inputBuffer: Buffer,
  preferredFormat: 'webp' | 'avif' | 'jpeg'
): Promise<Buffer> {
  const fileType = await fromBuffer(inputBuffer);
  
  if (!fileType) {
    throw new Error('Unsupported file format');
  }
  
  // Skip conversion if already in preferred format
  if (fileType.ext === preferredFormat) {
    return inputBuffer;
  }
  
  const qualityMap = {
    webp: 85,
    avif: 80,
    jpeg: 90
  };
  
  const transcoder = new ImageTranscoder({
    targetFormat: preferredFormat,
    quality: qualityMap[preferredFormat]
  });
  
  return transcoder.convert<Buffer>(inputBuffer);
}

// Usage
const result = await smartTranscode(imageBuffer, 'avif');
```

### Error Handling and Validation

```typescript
import { UnsupportedSource } from '@rytass/file-converter-adapter-image-transcoder';

async function safeTranscode(
  inputBuffer: Buffer,
  options: ImageTranscoderOptions
): Promise<Buffer | null> {
  try {
    const transcoder = new ImageTranscoder(options);
    return await transcoder.convert<Buffer>(inputBuffer);
  } catch (error) {
    if (error instanceof UnsupportedSource) {
      console.warn('Unsupported image format');
      return null;
    }
    
    console.error('Transcoding failed:', error.message);
    throw error;
  }
}

// Fallback strategy
async function transcodeWithFallback(
  inputBuffer: Buffer
): Promise<Buffer> {
  // Try modern formats first
  const formats = ['avif', 'webp', 'jpeg'] as const;
  
  for (const format of formats) {
    try {
      const transcoder = new ImageTranscoder({
        targetFormat: format,
        quality: 85
      });
      
      return await transcoder.convert<Buffer>(inputBuffer);
    } catch (error) {
      console.warn(`Failed to convert to ${format}:`, error.message);
    }
  }
  
  throw new Error('All transcoding attempts failed');
}
```

## Integration Examples

### Express.js Image API

```typescript
import express from 'express';
import multer from 'multer';
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Format conversion endpoint
app.post('/convert/:format', upload.single('image'), async (req, res) => {
  try {
    const { format } = req.params;
    const quality = parseInt(req.query.quality as string) || 85;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    
    if (!['webp', 'avif', 'jpeg', 'png'].includes(format)) {
      return res.status(400).json({ error: 'Unsupported format' });
    }
    
    const transcoder = new ImageTranscoder({
      targetFormat: format as any,
      quality
    });
    
    const convertedImage = await transcoder.convert<Buffer>(req.file.buffer);
    
    res.set('Content-Type', `image/${format}`);
    res.send(convertedImage);
  } catch (error) {
    res.status(500).json({ error: 'Conversion failed' });
  }
});

// Modern format serving with fallback
app.get('/image/:id', async (req, res) => {
  const { id } = req.params;
  const accepts = req.headers.accept || '';
  
  // Determine best format based on browser support
  let targetFormat: 'avif' | 'webp' | 'jpeg' = 'jpeg';
  if (accepts.includes('image/avif')) {
    targetFormat = 'avif';
  } else if (accepts.includes('image/webp')) {
    targetFormat = 'webp';
  }
  
  try {
    const originalImage = await getImageById(id); // Your image loading logic
    
    const transcoder = new ImageTranscoder({
      targetFormat,
      quality: 85
    });
    
    const optimizedImage = await transcoder.convert<Buffer>(originalImage);
    
    res.set('Content-Type', `image/${targetFormat}`);
    res.set('Cache-Control', 'public, max-age=31536000');
    res.send(optimizedImage);
  } catch (error) {
    res.status(404).json({ error: 'Image not found' });
  }
});
```

### NestJS Image Service

```typescript
import { Injectable } from '@nestjs/common';
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';

@Injectable()
export class ImageTranscodingService {
  private readonly webpTranscoder: ImageTranscoder;
  private readonly avifTranscoder: ImageTranscoder;
  private readonly jpegTranscoder: ImageTranscoder;

  constructor() {
    this.webpTranscoder = new ImageTranscoder({
      targetFormat: 'webp',
      quality: 85,
      effort: 4
    });

    this.avifTranscoder = new ImageTranscoder({
      targetFormat: 'avif',
      quality: 80,
      effort: 6
    });

    this.jpegTranscoder = new ImageTranscoder({
      targetFormat: 'jpeg',
      quality: 90,
      progressive: true
    });
  }

  async createImageVariants(
    originalBuffer: Buffer
  ): Promise<{
    webp: Buffer;
    avif: Buffer;
    jpeg: Buffer;
  }> {
    const [webp, avif, jpeg] = await Promise.all([
      this.webpTranscoder.convert<Buffer>(originalBuffer),
      this.avifTranscoder.convert<Buffer>(originalBuffer),
      this.jpegTranscoder.convert<Buffer>(originalBuffer)
    ]);

    return { webp, avif, jpeg };
  }

  async getBestFormat(
    originalBuffer: Buffer,
    acceptedFormats: string[]
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    if (acceptedFormats.includes('image/avif')) {
      const buffer = await this.avifTranscoder.convert<Buffer>(originalBuffer);
      return { buffer, mimeType: 'image/avif' };
    }

    if (acceptedFormats.includes('image/webp')) {
      const buffer = await this.webpTranscoder.convert<Buffer>(originalBuffer);
      return { buffer, mimeType: 'image/webp' };
    }

    const buffer = await this.jpegTranscoder.convert<Buffer>(originalBuffer);
    return { buffer, mimeType: 'image/jpeg' };
  }
}
```

### CDN Image Optimization

```typescript
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';

class CDNImageOptimizer {
  private transcoders = new Map<string, ImageTranscoder>();

  constructor() {
    // Pre-configure transcoders for different quality levels
    this.transcoders.set('high-webp', new ImageTranscoder({
      targetFormat: 'webp',
      quality: 95,
      effort: 6
    }));

    this.transcoders.set('medium-webp', new ImageTranscoder({
      targetFormat: 'webp',
      quality: 85,
      effort: 4
    }));

    this.transcoders.set('low-webp', new ImageTranscoder({
      targetFormat: 'webp',
      quality: 70,
      effort: 2
    }));

    this.transcoders.set('high-avif', new ImageTranscoder({
      targetFormat: 'avif',
      quality: 90,
      effort: 8
    }));

    this.transcoders.set('medium-avif', new ImageTranscoder({
      targetFormat: 'avif',
      quality: 80,
      effort: 6
    }));
  }

  async optimize(
    imageBuffer: Buffer,
    options: {
      format: 'webp' | 'avif';
      quality: 'high' | 'medium' | 'low';
    }
  ): Promise<Buffer> {
    const transcoderKey = `${options.quality}-${options.format}`;
    const transcoder = this.transcoders.get(transcoderKey);

    if (!transcoder) {
      throw new Error(`No transcoder configured for ${transcoderKey}`);
    }

    return transcoder.convert<Buffer>(imageBuffer);
  }

  async generateResponsiveVariants(
    imageBuffer: Buffer
  ): Promise<{
    webp: { high: Buffer; medium: Buffer; low: Buffer };
    avif: { high: Buffer; medium: Buffer };
  }> {
    const [
      webpHigh,
      webpMedium, 
      webpLow,
      avifHigh,
      avifMedium
    ] = await Promise.all([
      this.optimize(imageBuffer, { format: 'webp', quality: 'high' }),
      this.optimize(imageBuffer, { format: 'webp', quality: 'medium' }),
      this.optimize(imageBuffer, { format: 'webp', quality: 'low' }),
      this.optimize(imageBuffer, { format: 'avif', quality: 'high' }),
      this.optimize(imageBuffer, { format: 'avif', quality: 'medium' })
    ]);

    return {
      webp: { high: webpHigh, medium: webpMedium, low: webpLow },
      avif: { high: avifHigh, medium: avifMedium }
    };
  }
}
```

## Performance Guidelines

### Memory Management
- Use streams for files larger than 50MB
- Set appropriate concurrency limits (2-4 for CPU-intensive formats like AVIF)
- Monitor memory usage in production environments

### Format Selection
- **AVIF**: Best compression, slower encoding, limited browser support
- **WebP**: Good compression, fast encoding, wide browser support
- **JPEG**: Universal compatibility, fast encoding

### Quality Settings
- **High quality**: 90-95 for archival/professional use
- **Standard quality**: 80-85 for web content
- **Low quality**: 60-75 for thumbnails/previews

### Optimization Tips
- Lower effort settings for real-time processing
- Higher effort settings for batch processing
- Use progressive formats for better perceived performance
- Cache converted images to avoid repeated processing

## Error Handling

The adapter throws specific errors for different failure scenarios:

```typescript
import { UnsupportedSource } from '@rytass/file-converter-adapter-image-transcoder';

try {
  const result = await transcoder.convert<Buffer>(imageBuffer);
} catch (error) {
  if (error instanceof UnsupportedSource) {
    // Handle unsupported input format
    console.error('Input format not supported');
  } else {
    // Handle other transcoding errors
    console.error('Transcoding failed:', error.message);
  }
}
```

## Testing

```typescript
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';
import { readFileSync } from 'fs';
import sharp from 'sharp';

describe('ImageTranscoder', () => {
  it('should convert JPEG to WebP', async () => {
    const transcoder = new ImageTranscoder({
      targetFormat: 'webp',
      quality: 85
    });

    const jpegBuffer = createTestJpeg();
    const webpBuffer = await transcoder.convert<Buffer>(jpegBuffer);

    const metadata = await sharp(webpBuffer).metadata();
    expect(metadata.format).toBe('webp');
  });

  it('should maintain quality in lossless conversion', async () => {
    const transcoder = new ImageTranscoder({
      targetFormat: 'png'
    });

    const originalBuffer = createTestImage();
    const convertedBuffer = await transcoder.convert<Buffer>(originalBuffer);

    const [originalMeta, convertedMeta] = await Promise.all([
      sharp(originalBuffer).metadata(),
      sharp(convertedBuffer).metadata()
    ]);

    expect(convertedMeta.width).toBe(originalMeta.width);
    expect(convertedMeta.height).toBe(originalMeta.height);
  });
});
```

## Best Practices

### Format Strategy
- Use AVIF for maximum compression when encoding time isn't critical
- Use WebP for balanced compression and compatibility
- Provide JPEG fallbacks for maximum browser support

### Quality Configuration  
- Test different quality settings with your typical image content
- Consider using different quality settings for different image types
- Monitor file size vs quality trade-offs

### Performance
- Use appropriate effort settings based on your use case
- Implement caching to avoid repeated conversions
- Consider using worker threads for CPU-intensive batch processing

### Error Handling
- Always handle UnsupportedSource errors gracefully
- Implement fallback strategies for critical conversions
- Log conversion failures for monitoring and debugging

## License

MIT
