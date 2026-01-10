# ImageTranscoder Complete Reference

Complete API reference for `@rytass/file-converter-adapter-image-transcoder`.

## Overview

ImageTranscoder provides powerful image format conversion capabilities with format-specific optimization options. It can convert between modern and legacy image formats while providing fine-grained control over quality, compression, and format-specific features.

**Key Features:**
- Convert between 7 output formats (JPEG, PNG, WebP, AVIF, HEIF, GIF, TIFF)
- Accept 7 input formats (JPEG, PNG, WebP, GIF, AVIF, TIFF, SVG)
- Format-specific quality and compression options (格式特定品質與壓縮選項)
- Automatic input format detection (自動輸入格式偵測)
- Modern format support (WebP, AVIF, HEIF) for optimal file sizes
- Buffer and Stream processing (緩衝與串流處理)

## Installation

```bash
npm install @rytass/file-converter-adapter-image-transcoder
```

**Dependencies:**
- `@rytass/file-converter` ^0.1.5
- `sharp` ^0.34.5
- `file-type` ^21.1.1 (for input format detection)

## Supported Formats

### Input Formats (輸入格式)

| Format | Extensions | Notes |
|--------|-----------|-------|
| JPEG | `.jpg`, `.jpeg` | Widely supported |
| PNG | `.png` | Lossless, transparency support |
| WebP | `.webp` | Modern format, good compression |
| GIF | `.gif` | Animation support (first frame only) |
| AVIF | `.avif` | Next-gen format, excellent compression |
| TIFF | `.tif`, `.tiff` | Professional/archival format |
| SVG | `.svg` | Vector format (rasterized on input) |

### Output Formats (輸出格式)

| Format | Use Case | Quality Range | Typical Size |
|--------|----------|--------------|--------------|
| **JPEG** | Photos, web images (照片、網頁圖片) | 0-100 | Medium |
| **PNG** | Logos, transparency (標誌、透明) | 0-9 (compression) | Large |
| **WebP** | Modern web (現代網頁) | 0-100 | Small-Medium |
| **AVIF** | Next-gen web (次世代網頁) | 0-100 | Very Small |
| **HEIF** | iOS/macOS images | 0-100 | Small |
| **GIF** | Simple graphics, compatibility | N/A | Medium |
| **TIFF** | Archival, professional (專業用途) | 0-100 | Large |

### Format Compatibility Matrix

| Input → Output | JPEG | PNG | WebP | AVIF | HEIF | GIF | TIFF |
|----------------|:----:|:---:|:----:|:----:|:----:|:---:|:----:|
| **JPEG** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **PNG** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **WebP** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **GIF** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **AVIF** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **TIFF** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **SVG** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**Note:** All conversions are supported. SVG input is rasterized first.

## Constructor

### `new ImageTranscoder(options: ImageTranscoderOptions)`

Creates a new ImageTranscoder instance with format-specific configuration.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options` | `ImageTranscoderOptions` | Yes | Transcoder configuration (union type based on target format) |

**ImageTranscoderOptions** is a **discriminated union type**. You must specify `targetFormat` to determine which other options are available.

**Common Properties:**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `targetFormat` | `'jpg' \| 'jpeg' \| 'png' \| 'webp' \| 'avif' \| 'heif' \| 'gif' \| 'tiff'` | Yes | N/A | Output format (輸出格式) |
| `concurrency` | `number` | No | `1` | Sharp processing threads (處理執行緒數) |

**Format-Specific Properties:** See "Format-Specific Options" section below.

**Example:**

```typescript
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';

// WebP conversion
const webpTranscoder = new ImageTranscoder({
  targetFormat: 'webp',
  quality: 85,
  effort: 4,
});

// AVIF conversion with advanced options
const avifTranscoder = new ImageTranscoder({
  targetFormat: 'avif',
  quality: 80,
  effort: 4,
  chromaSubsampling: '4:4:4', // Better color quality
  lossless: false,
});

// PNG with compression
const pngTranscoder = new ImageTranscoder({
  targetFormat: 'png',
  compressionLevel: 9, // Maximum compression
  progressive: true,
});
```

## Methods

### `convert<Output extends ConvertableFile>(file: ConvertableFile): Promise<Output>`

Converts an image to the target format specified in the constructor.

**Generic Type Parameters:**

| Parameter | Description |
|-----------|-------------|
| `Output` | Output type, must be either `Buffer` or `Readable` (Stream) |

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file` | `ConvertableFile` (Buffer \| Readable) | Input image file |

**Returns:** `Promise<Output>`

- Returns `Promise<Buffer>` when input is Buffer
- Returns `Promise<Readable>` when input is Stream

**Input Validation:**
- For **Buffer input**: Automatically detects format using `file-type` library
- For **Stream input**: No automatic detection (ensure correct format)
- Throws `UnsupportedSource` error if input format is not supported

**Examples:**

#### Basic Conversion

```typescript
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';
import { readFileSync, writeFileSync } from 'fs';

const transcoder = new ImageTranscoder({
  targetFormat: 'webp',
  quality: 85,
});

const jpegBuffer = readFileSync('photo.jpg');
const webpBuffer = await transcoder.convert<Buffer>(jpegBuffer);
writeFileSync('photo.webp', webpBuffer);
```

#### Stream Conversion

```typescript
import { createReadStream, createWriteStream } from 'fs';
import { Readable } from 'stream';

const transcoder = new ImageTranscoder({
  targetFormat: 'avif',
  quality: 80,
});

const inputStream = createReadStream('photo.jpg');
const outputStream = await transcoder.convert<Readable>(inputStream);
outputStream.pipe(createWriteStream('photo.avif'));
```

## Format-Specific Options

### JPEG Options

Convert to JPEG format with quality and encoding options.

```typescript
interface JPEGOptions {
  targetFormat: 'jpg' | 'jpeg';
  quality?: number;          // 1-100, default: 80
  progressive?: boolean;     // Progressive encoding, default: false
  mozjpeg?: boolean;         // Use MozJPEG encoder, default: false
  chromaSubsampling?: string; // '4:4:4', '4:2:2', '4:2:0'
  optimiseCoding?: boolean;   // Optimise Huffman coding, default: true
  trellisQuantisation?: boolean; // Apply trellis quantisation
}
```

**Quality Recommendations:**

| Use Case | Quality | File Size | Visual Quality |
|----------|---------|-----------|----------------|
| High-quality photos | 90-95 | Large | Excellent |
| General web photos | 80-85 | Medium | Very Good |
| Thumbnails | 70-75 | Small | Good |
| Low bandwidth | 60-65 | Very Small | Acceptable |

**Example:**

```typescript
const jpegTranscoder = new ImageTranscoder({
  targetFormat: 'jpeg',
  quality: 85,
  progressive: true,
  mozjpeg: true, // Better compression
  chromaSubsampling: '4:2:0', // Smaller file size
});
```

### PNG Options

Convert to PNG format with compression and palette options.

```typescript
interface PNGOptions {
  targetFormat: 'png';
  compressionLevel?: number; // 0-9, default: 6
  progressive?: boolean;     // Interlaced PNG, default: false
  palette?: boolean;         // Use 8-bit palette, default: false
  quality?: number;          // Quantization quality (0-100) when palette=true
  effort?: number;           // CPU effort (1-10), default: 7
  colours?: number;          // Max colors in palette (2-256)
  dither?: number;           // Dithering level (0-1), default: 1.0
}
```

**Compression Level Guide:**

| Level | Speed | File Size | Use Case |
|-------|-------|-----------|----------|
| 0 | Fastest | Largest | Quick processing |
| 3 | Fast | Large | Development |
| 6 (default) | Balanced | Medium | General use |
| 9 | Slowest | Smallest | Production |

**Example:**

```typescript
// Maximum compression
const pngTranscoder = new ImageTranscoder({
  targetFormat: 'png',
  compressionLevel: 9,
  progressive: true,
  effort: 10,
});

// Palette mode for icons/logos (smaller files)
const paletteTranscoder = new ImageTranscoder({
  targetFormat: 'png',
  palette: true,
  colours: 256,
  quality: 80,
});
```

### WebP Options

Convert to WebP format with advanced compression options.

```typescript
interface WebPOptions {
  targetFormat: 'webp';
  quality?: number;          // 1-100, default: 80
  alphaQuality?: number;     // 0-100, transparency quality
  lossless?: boolean;        // Lossless compression, default: false
  nearLossless?: boolean;    // Near-lossless compression
  smartSubsample?: boolean;  // Use sharp chroma subsampling
  effort?: number;           // CPU effort (0-6), default: 4
  minSize?: boolean;         // Minimize file size
  mixed?: boolean;           // Mix lossy & lossless
}
```

**Quality vs File Size (Lossy Mode):**

| Quality | File Size | Visual Quality | Use Case |
|---------|-----------|----------------|----------|
| 90-100 | Large | Excellent | High-quality photos |
| 80-90 | Medium | Very Good | General web use |
| 70-80 | Small | Good | Thumbnails |
| 60-70 | Very Small | Acceptable | Low bandwidth |

**Example:**

```typescript
// Lossy WebP for photos
const lossyWebP = new ImageTranscoder({
  targetFormat: 'webp',
  quality: 85,
  effort: 6, // More compression effort
  smartSubsample: true,
});

// Lossless WebP for graphics
const losslessWebP = new ImageTranscoder({
  targetFormat: 'webp',
  lossless: true,
  effort: 6,
});

// Transparency preservation
const transparentWebP = new ImageTranscoder({
  targetFormat: 'webp',
  quality: 85,
  alphaQuality: 100, // High transparency quality
});
```

### AVIF Options

Convert to AVIF format (next-generation image format with excellent compression).

```typescript
interface AVIFOptions {
  targetFormat: 'avif';
  quality?: number;           // 1-100, default: 50
  lossless?: boolean;         // Lossless compression, default: false
  effort?: number;            // CPU effort (0-9), default: 4
  chromaSubsampling?: string; // '4:4:4', '4:2:2', '4:2:0', '4:0:0'
  bitdepth?: number;          // 8, 10, or 12 bits per channel
}
```

**Quality Recommendations:**

| Quality | File Size vs JPEG | Visual Quality | Use Case |
|---------|------------------|----------------|----------|
| 70-80 | ~40% smaller | Excellent | High-quality photos |
| 60-70 | ~50% smaller | Very Good | General web use |
| 50-60 | ~60% smaller | Good | Default recommendation |
| 40-50 | ~70% smaller | Acceptable | Small file sizes |

**Example:**

```typescript
// High-quality AVIF
const highQualityAVIF = new ImageTranscoder({
  targetFormat: 'avif',
  quality: 75,
  effort: 6,
  chromaSubsampling: '4:4:4', // Best color quality
  bitdepth: 10, // Higher color depth
});

// Balanced AVIF
const balancedAVIF = new ImageTranscoder({
  targetFormat: 'avif',
  quality: 60,
  effort: 4,
  chromaSubsampling: '4:2:0',
});

// Lossless AVIF
const losslessAVIF = new ImageTranscoder({
  targetFormat: 'avif',
  lossless: true,
  effort: 9,
});
```

### HEIF Options

Convert to HEIF format (High Efficiency Image Format, used by iOS/macOS).

```typescript
interface HEIFOptions {
  targetFormat: 'heif';
  quality?: number;       // 1-100, default: 80
  compression?: string;   // 'av1', 'hevc', default: 'av1'
  effort?: number;        // CPU effort (0-9), default: 4
  chromaSubsampling?: string; // '4:4:4', '4:2:2', '4:2:0'
  lossless?: boolean;     // Lossless compression, default: false
}
```

**Example:**

```typescript
const heifTranscoder = new ImageTranscoder({
  targetFormat: 'heif',
  quality: 85,
  compression: 'av1', // Modern AV1 codec
  effort: 5,
});
```

### GIF Options

Convert to GIF format (limited color palette, good compatibility).

```typescript
interface GIFOptions {
  targetFormat: 'gif';
  colours?: number;       // Max colors (2-256), default: 256
  effort?: number;        // CPU effort (1-10), default: 7
  dither?: number;        // Dithering level (0-1), default: 1.0
}
```

**Example:**

```typescript
const gifTranscoder = new ImageTranscoder({
  targetFormat: 'gif',
  colours: 256,
  effort: 10,
  dither: 1.0,
});
```

### TIFF Options

Convert to TIFF format (professional/archival format).

```typescript
interface TIFFOptions {
  targetFormat: 'tiff';
  quality?: number;        // 1-100, default: 80
  compression?: string;    // 'lzw', 'deflate', 'jpeg', 'none'
  predictor?: string;      // 'horizontal', 'float', 'none'
  pyramid?: boolean;       // Create pyramid TIFF
  tile?: boolean;          // Create tiled TIFF
  tileWidth?: number;      // Tile width in pixels
  tileHeight?: number;     // Tile height in pixels
  xres?: number;           // Horizontal resolution (DPI)
  yres?: number;           // Vertical resolution (DPI)
  bitdepth?: number;       // 1, 2, 4, or 8 bits per channel
}
```

**Example:**

```typescript
const tiffTranscoder = new ImageTranscoder({
  targetFormat: 'tiff',
  compression: 'lzw',
  predictor: 'horizontal',
  xres: 300, // 300 DPI
  yres: 300,
});
```

## Error Handling

### UnsupportedSource Error

Thrown when input format is not supported.

```typescript
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';

const transcoder = new ImageTranscoder({ targetFormat: 'webp', quality: 85 });

try {
  const buffer = readFileSync('document.pdf'); // Unsupported format
  await transcoder.convert<Buffer>(buffer);
} catch (error) {
  if (error.message === 'UnsupportedSource') {
    console.error('Input format not supported. Supported: JPEG, PNG, WebP, GIF, AVIF, TIFF, SVG');
  }
}
```

**Supported Input Formats:** JPEG, PNG, WebP, GIF, AVIF, TIFF, SVG

**Not Supported:** PDF, BMP, ICO, PSD, AI, EPS, RAW formats

## Use Cases

### Modern Web Format Conversion

Convert legacy formats to modern WebP or AVIF for smaller file sizes:

```typescript
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';
import { readFileSync, writeFileSync } from 'fs';

// Convert JPEG to WebP (typically 25-35% smaller)
const webpConverter = new ImageTranscoder({
  targetFormat: 'webp',
  quality: 85,
  effort: 6,
});

const jpegBuffer = readFileSync('photo.jpg');
const webpBuffer = await webpConverter.convert<Buffer>(jpegBuffer);
writeFileSync('photo.webp', webpBuffer);

// Convert to AVIF (typically 40-50% smaller than JPEG)
const avifConverter = new ImageTranscoder({
  targetFormat: 'avif',
  quality: 60,
  effort: 6,
});

const avifBuffer = await avifConverter.convert<Buffer>(jpegBuffer);
writeFileSync('photo.avif', avifBuffer);
```

### File Size Optimization

Optimize images for web delivery:

```typescript
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';
import { statSync } from 'fs';

async function optimizeImage(inputPath: string) {
  const original = readFileSync(inputPath);
  const originalSize = statSync(inputPath).size;

  // Try different formats and qualities
  const converters = [
    { name: 'webp-85', transcoder: new ImageTranscoder({ targetFormat: 'webp', quality: 85 }) },
    { name: 'webp-75', transcoder: new ImageTranscoder({ targetFormat: 'webp', quality: 75 }) },
    { name: 'avif-60', transcoder: new ImageTranscoder({ targetFormat: 'avif', quality: 60 }) },
    { name: 'avif-50', transcoder: new ImageTranscoder({ targetFormat: 'avif', quality: 50 }) },
  ];

  console.log(`Original: ${(originalSize / 1024).toFixed(2)} KB`);

  for (const { name, transcoder } of converters) {
    const converted = await transcoder.convert<Buffer>(original);
    const newSize = converted.length;
    const savings = ((1 - newSize / originalSize) * 100).toFixed(1);

    console.log(`${name}: ${(newSize / 1024).toFixed(2)} KB (${savings}% smaller)`);
  }
}

await optimizeImage('photo.jpg');
// Output:
// Original: 1250.50 KB
// webp-85: 875.30 KB (30.0% smaller)
// webp-75: 725.80 KB (42.0% smaller)
// avif-60: 625.20 KB (50.0% smaller)
// avif-50: 550.15 KB (56.0% smaller)
```

### Format Standardization

Standardize images to a single format:

```typescript
import { glob } from 'glob';
import { basename } from 'path';

async function standardizeFormats() {
  const transcoder = new ImageTranscoder({
    targetFormat: 'png',
    compressionLevel: 9,
  });

  // Find all images
  const images = await glob('input/**/*.{jpg,jpeg,gif,webp,bmp}');

  for (const imagePath of images) {
    const buffer = readFileSync(imagePath);
    const pngBuffer = await transcoder.convert<Buffer>(buffer);

    const outputName = basename(imagePath).replace(/\.(jpg|jpeg|gif|webp|bmp)$/, '.png');
    writeFileSync(`output/${outputName}`, pngBuffer);
  }

  console.log(`Converted ${images.length} images to PNG`);
}
```

## Complete Example

### Multi-Format Image Converter

```typescript
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { basename } from 'path';

// Create multiple format converters
const converters = {
  webp: new ImageTranscoder({ targetFormat: 'webp', quality: 85, effort: 6 }),
  avif: new ImageTranscoder({ targetFormat: 'avif', quality: 60, effort: 6 }),
  jpeg: new ImageTranscoder({ targetFormat: 'jpeg', quality: 85, progressive: true }),
  png: new ImageTranscoder({ targetFormat: 'png', compressionLevel: 9 }),
};

// Create output directories
['webp', 'avif', 'jpeg', 'png'].forEach(format => {
  mkdirSync(`output/${format}`, { recursive: true });
});

async function convertToAllFormats(inputPath: string) {
  const fileName = basename(inputPath, '.jpg');
  const original = readFileSync(inputPath);

  console.log(`Converting: ${fileName}`);

  // Convert to all formats
  for (const [format, converter] of Object.entries(converters)) {
    try {
      const converted = await converter.convert<Buffer>(original);
      writeFileSync(`output/${format}/${fileName}.${format}`, converted);
      console.log(`  ✓ ${format}: ${(converted.length / 1024).toFixed(2)} KB`);
    } catch (error) {
      console.error(`  ✗ ${format}: Failed - ${error.message}`);
    }
  }
}

// Process images
const images = ['photo1.jpg', 'photo2.jpg', 'photo3.jpg'];
for (const image of images) {
  await convertToAllFormats(image);
}
```

### Responsive Image Generator with Format Variants

```typescript
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';
import { ConverterManager } from '@rytass/file-converter';

async function generateResponsiveVariants(inputPath: string) {
  const original = readFileSync(inputPath);
  const baseName = basename(inputPath, '.jpg');

  // Sizes: 400px, 800px, 1200px
  const sizes = [400, 800, 1200];

  // Formats: WebP and AVIF
  const formats = [
    { ext: 'webp', transcoder: new ImageTranscoder({ targetFormat: 'webp', quality: 85 }) },
    { ext: 'avif', transcoder: new ImageTranscoder({ targetFormat: 'avif', quality: 60 }) },
  ];

  for (const width of sizes) {
    for (const { ext, transcoder } of formats) {
      // Create pipeline: Resize → Convert
      const pipeline = new ConverterManager([
        new ImageResizer({ maxWidth: width, keepAspectRatio: true }),
        transcoder,
      ]);

      const result = await pipeline.convert<Buffer>(original);
      writeFileSync(`output/${baseName}-${width}w.${ext}`, result);

      console.log(`Generated: ${baseName}-${width}w.${ext}`);
    }
  }
}

await generateResponsiveVariants('hero-image.jpg');
// Output:
// hero-image-400w.webp, hero-image-400w.avif
// hero-image-800w.webp, hero-image-800w.avif
// hero-image-1200w.webp, hero-image-1200w.avif
```
