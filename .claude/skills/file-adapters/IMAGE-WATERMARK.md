# ImageWatermark Complete Reference

Complete API reference for `@rytass/file-converter-adapter-image-watermark`.

## Overview

ImageWatermark provides flexible watermark overlay capabilities with precise positioning control. It supports multiple watermarks, various positioning options, and both Buffer and Stream processing.

**Key Features:**
- Add single or multiple watermarks (單一或多個浮水印)
- 9 position presets (9 個位置預設)
- Support watermark images as Buffer or file path (支援緩衝或檔案路徑)
- Automatic transparency preservation (自動保留透明度)
- Memory-efficient stream processing (記憶體高效串流處理)

## Installation

```bash
npm install @rytass/file-converter-adapter-image-watermark
```

**Dependencies:**
- `@rytass/file-converter` ^0.1.5
- `sharp` ^0.34.5

## Constructor

### `new ImageWatermark(options: ImageWatermarkOptions)`

Creates a new ImageWatermark instance with watermark configuration.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options` | `ImageWatermarkOptions` | Yes | Watermark configuration object |

**ImageWatermarkOptions Properties:**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `watermarks` | `Watermark[]` | Yes | N/A | Array of watermarks to apply (浮水印陣列). Applied in order. |
| `concurrency` | `number` | No | `1` | Number of threads for Sharp processing (Sharp 處理執行緒數) |

**Watermark Object:**

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `image` | `string \| Buffer` | Yes | N/A | Watermark image (浮水印圖片). Can be file path (string) or Buffer. |
| `gravity` | `gravity` | No | `gravity.southeast` | Position of watermark (浮水印位置). Uses Sharp's gravity constants. |

**Example:**

```typescript
import { ImageWatermark } from '@rytass/file-converter-adapter-image-watermark';
import { gravity } from 'sharp';
import { readFileSync } from 'fs';

// Single watermark at bottom-right (default)
const singleWatermark = new ImageWatermark({
  watermarks: [
    {
      image: './logo.png', // File path
      gravity: gravity.southeast, // Bottom-right (default)
    },
  ],
});

// Multiple watermarks
const multiWatermark = new ImageWatermark({
  watermarks: [
    {
      image: readFileSync('top-logo.png'), // Buffer
      gravity: gravity.northeast, // Top-right
    },
    {
      image: readFileSync('bottom-logo.png'), // Buffer
      gravity: gravity.southwest, // Bottom-left
    },
  ],
  concurrency: 4,
});

// Center watermark
const centerWatermark = new ImageWatermark({
  watermarks: [
    {
      image: './watermark.png',
      gravity: gravity.center, // Center
    },
  ],
});
```

## Methods

### `convert<Output extends ConvertableFile>(file: ConvertableFile): Promise<Output>`

Applies watermark(s) to an image. The output type matches the input type.

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

**Behavior:**
- Watermarks are applied in the order they appear in the `watermarks` array
- Each watermark is composited onto the image at its specified position
- Original image format is preserved (JPEG → JPEG, PNG → PNG, etc.)
- Transparency in watermark images is respected

**Examples:**

#### Buffer Input/Output

```typescript
import { ImageWatermark } from '@rytass/file-converter-adapter-image-watermark';
import { gravity } from 'sharp';
import { readFileSync, writeFileSync } from 'fs';

const watermarker = new ImageWatermark({
  watermarks: [
    {
      image: readFileSync('logo.png'),
      gravity: gravity.southeast,
    },
  ],
});

const originalImage = readFileSync('photo.jpg');
const watermarkedImage = await watermarker.convert<Buffer>(originalImage);
writeFileSync('photo-watermarked.jpg', watermarkedImage);
```

#### Stream Input/Output

```typescript
import { createReadStream, createWriteStream } from 'fs';
import { Readable } from 'stream';

const watermarker = new ImageWatermark({
  watermarks: [
    {
      image: './logo.png',
      gravity: gravity.southeast,
    },
  ],
});

const inputStream = createReadStream('large-photo.jpg');
const outputStream = await watermarker.convert<Readable>(inputStream);

outputStream.pipe(createWriteStream('large-photo-watermarked.jpg'));
```

## Watermark Configuration

### Image Property

The `image` property accepts two types:

#### File Path (String)

```typescript
const watermarker = new ImageWatermark({
  watermarks: [
    {
      image: './logo.png', // Relative path
    },
    {
      image: '/absolute/path/to/watermark.png', // Absolute path
    },
  ],
});
```

**Advantages:**
- Simple and clean code
- Sharp loads file directly
- Suitable for static watermarks

#### Buffer

```typescript
import { readFileSync } from 'fs';

const watermarkBuffer = readFileSync('logo.png');

const watermarker = new ImageWatermark({
  watermarks: [
    {
      image: watermarkBuffer, // Buffer
    },
  ],
});
```

**Advantages:**
- Pre-load watermark once, reuse multiple times
- Can generate watermarks programmatically
- Suitable for dynamic watermarks

**Example - Reusing Watermark Buffer:**

```typescript
// Load watermark once
const logoBuffer = readFileSync('logo.png');

// Create multiple watermarkers with same watermark
const topRightWatermarker = new ImageWatermark({
  watermarks: [{ image: logoBuffer, gravity: gravity.northeast }],
});

const bottomLeftWatermarker = new ImageWatermark({
  watermarks: [{ image: logoBuffer, gravity: gravity.southwest }],
});

// Process multiple images efficiently
for (const imagePath of images) {
  const image = readFileSync(imagePath);
  const watermarked = await topRightWatermarker.convert<Buffer>(image);
  writeFileSync(`output/${imagePath}`, watermarked);
}
```

### Multiple Watermarks

Apply multiple watermarks to the same image:

```typescript
const multiWatermarker = new ImageWatermark({
  watermarks: [
    {
      image: './logo-top-right.png',
      gravity: gravity.northeast, // Top-right
    },
    {
      image: './logo-bottom-left.png',
      gravity: gravity.southwest, // Bottom-left
    },
    {
      image: './center-watermark.png',
      gravity: gravity.center, // Center
    },
  ],
});
```

**Application Order:**
- Watermarks are applied sequentially in array order
- First watermark is applied first, last watermark on top
- Later watermarks may overlap earlier ones

## Gravity Positions

### Position Grid

```
┌─────────────────────────────────────┐
│ northwest    north      northeast   │
│ (左上)       (上中)      (右上)      │
│                                     │
│                                     │
│ west         center        east     │
│ (中左)       (中央)        (中右)    │
│                                     │
│                                     │
│ southwest    south      southeast   │
│ (左下)       (下中)      (右下)      │
└─────────────────────────────────────┘
```

### Gravity Constants

Import from Sharp:

```typescript
import { gravity } from 'sharp';
```

| Constant | Position | Chinese | Description |
|----------|----------|---------|-------------|
| `gravity.northwest` | Top-Left | 左上 | Northwest corner |
| `gravity.north` | Top-Center | 上中 | Top center |
| `gravity.northeast` | Top-Right | 右上 | Northeast corner |
| `gravity.west` | Middle-Left | 中左 | Middle left edge |
| `gravity.center` | Center | 中央 | Center of image |
| `gravity.east` | Middle-Right | 中右 | Middle right edge |
| `gravity.southwest` | Bottom-Left | 左下 | Southwest corner |
| `gravity.south` | Bottom-Center | 下中 | Bottom center |
| `gravity.southeast` | Bottom-Right (Default) | 右下 | Southeast corner |

### Position Examples

```typescript
import { ImageWatermark } from '@rytass/file-converter-adapter-image-watermark';
import { gravity } from 'sharp';

// Top-left corner
const topLeft = new ImageWatermark({
  watermarks: [{ image: './logo.png', gravity: gravity.northwest }],
});

// Top-right corner
const topRight = new ImageWatermark({
  watermarks: [{ image: './logo.png', gravity: gravity.northeast }],
});

// Center
const center = new ImageWatermark({
  watermarks: [{ image: './watermark.png', gravity: gravity.center }],
});

// Bottom-right (default - most common for branding)
const bottomRight = new ImageWatermark({
  watermarks: [{ image: './logo.png', gravity: gravity.southeast }],
});
```

## Use Cases

### Brand Logo Watermark

Add company logo to all product/marketing photos:

```typescript
import { ImageWatermark } from '@rytass/file-converter-adapter-image-watermark';
import { gravity } from 'sharp';

const brandWatermarker = new ImageWatermark({
  watermarks: [
    {
      image: './brand-logo.png',
      gravity: gravity.southeast, // Bottom-right is standard for branding
    },
  ],
  concurrency: 4,
});

// Process all photos
const photos = await glob('photos/**/*.jpg');
for (const photo of photos) {
  const original = readFileSync(photo);
  const branded = await brandWatermarker.convert<Buffer>(original);
  writeFileSync(`branded/${basename(photo)}`, branded);
}
```

### Copyright Notice

Add copyright text watermark (pre-generated as image):

```typescript
// First, create copyright watermark image (using Sharp or other tools)
// Example: "© 2024 Company Name. All Rights Reserved."

const copyrightWatermarker = new ImageWatermark({
  watermarks: [
    {
      image: './copyright-text.png',
      gravity: gravity.south, // Bottom-center
    },
  ],
});
```

### Multiple Logo Placement

Add multiple branding elements:

```typescript
const multiLogoWatermarker = new ImageWatermark({
  watermarks: [
    {
      image: './main-logo.png',
      gravity: gravity.northeast, // Top-right: Main logo
    },
    {
      image: './partner-logo.png',
      gravity: gravity.northwest, // Top-left: Partner logo
    },
    {
      image: './copyright.png',
      gravity: gravity.south, // Bottom-center: Copyright
    },
  ],
});
```

### Draft/Sample Watermark

Add large center watermark for drafts or samples:

```typescript
const draftWatermarker = new ImageWatermark({
  watermarks: [
    {
      image: './draft-watermark.png', // Large, semi-transparent "DRAFT" text
      gravity: gravity.center,
    },
  ],
});
```

## Complete Example

### E-commerce Product Watermarking System

```typescript
import { ImageWatermark } from '@rytass/file-converter-adapter-image-watermark';
import { gravity } from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { glob } from 'glob';
import { basename, join } from 'path';

// Pre-load watermarks
const watermarks = {
  brandLogo: readFileSync('watermarks/brand-logo.png'),
  copyright: readFileSync('watermarks/copyright.png'),
  draft: readFileSync('watermarks/draft.png'),
};

// Create different watermarkers for different purposes
const watermarkers = {
  // Production: Brand logo only
  production: new ImageWatermark({
    watermarks: [
      {
        image: watermarks.brandLogo,
        gravity: gravity.southeast,
      },
    ],
    concurrency: 4,
  }),

  // Full branding: Logo + Copyright
  full: new ImageWatermark({
    watermarks: [
      {
        image: watermarks.brandLogo,
        gravity: gravity.northeast,
      },
      {
        image: watermarks.copyright,
        gravity: gravity.south,
      },
    ],
    concurrency: 4,
  }),

  // Draft/Preview: Large DRAFT watermark
  draft: new ImageWatermark({
    watermarks: [
      {
        image: watermarks.draft,
        gravity: gravity.center,
      },
      {
        image: watermarks.copyright,
        gravity: gravity.south,
      },
    ],
    concurrency: 4,
  }),
};

// Setup output directories
mkdirSync('output/production', { recursive: true });
mkdirSync('output/full', { recursive: true });
mkdirSync('output/draft', { recursive: true });

async function processProductImages() {
  const images = await glob('product-photos/**/*.{jpg,png}');

  console.log(`Processing ${images.length} product images...`);

  for (const imagePath of images) {
    const fileName = basename(imagePath);
    const original = readFileSync(imagePath);

    try {
      // Generate all variants
      const production = await watermarkers.production.convert<Buffer>(original);
      const full = await watermarkers.full.convert<Buffer>(original);
      const draft = await watermarkers.draft.convert<Buffer>(original);

      // Save to respective directories
      writeFileSync(join('output/production', fileName), production);
      writeFileSync(join('output/full', fileName), full);
      writeFileSync(join('output/draft', fileName), draft);

      console.log(`✓ Processed: ${fileName}`);
    } catch (error) {
      console.error(`✗ Failed: ${fileName}`, error.message);
    }
  }

  console.log('All product images processed!');
}

// Run processing
processProductImages().catch(console.error);
```

### Dynamic Watermark Position Based on Image Orientation

```typescript
import sharp from 'sharp';
import { ImageWatermark } from '@rytass/file-converter-adapter-image-watermark';
import { gravity } from 'sharp';

async function smartWatermark(imagePath: string) {
  // Get image metadata
  const metadata = await sharp(imagePath).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to read image dimensions');
  }

  // Choose position based on orientation
  let position: keyof typeof gravity;

  if (metadata.width > metadata.height) {
    // Landscape: bottom-right
    position = 'southeast';
  } else {
    // Portrait: bottom-center
    position = 'south';
  }

  // Create watermarker with chosen position
  const watermarker = new ImageWatermark({
    watermarks: [
      {
        image: './logo.png',
        gravity: gravity[position],
      },
    ],
  });

  // Apply watermark
  const original = readFileSync(imagePath);
  const watermarked = await watermarker.convert<Buffer>(original);

  return watermarked;
}

// Usage
const landscapePhoto = await smartWatermark('landscape.jpg'); // Logo at bottom-right
const portraitPhoto = await smartWatermark('portrait.jpg');  // Logo at bottom-center
```

### Batch Processing with Progress Tracking

```typescript
import { ImageWatermark } from '@rytass/file-converter-adapter-image-watermark';
import { gravity } from 'sharp';
import { glob } from 'glob';
import { basename } from 'path';

const watermarker = new ImageWatermark({
  watermarks: [
    {
      image: readFileSync('logo.png'),
      gravity: gravity.southeast,
    },
  ],
  concurrency: 8, // High concurrency for batch processing
});

async function batchWatermark() {
  const images = await glob('input/**/*.{jpg,jpeg,png}');
  const total = images.length;
  let processed = 0;
  let failed = 0;

  console.log(`Found ${total} images to watermark`);

  const startTime = Date.now();

  for (const imagePath of images) {
    try {
      const original = readFileSync(imagePath);
      const watermarked = await watermarker.convert<Buffer>(original);

      writeFileSync(`output/${basename(imagePath)}`, watermarked);

      processed++;
      const progress = ((processed / total) * 100).toFixed(1);
      console.log(`[${progress}%] ✓ ${basename(imagePath)}`);
    } catch (error) {
      failed++;
      console.error(`✗ Failed: ${basename(imagePath)} - ${error.message}`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\nCompleted: ${processed}/${total} images in ${duration}s`);
  if (failed > 0) {
    console.error(`Failed: ${failed} images`);
  }
}

batchWatermark().catch(console.error);
```

## Best Practices

### Watermark Image Preparation

**Transparency:**
- Use PNG format with transparency for watermark images
- Semi-transparent watermarks (50-70% opacity) are less intrusive
- Create watermark with appropriate size relative to target images

**Size Recommendations:**

| Image Size | Watermark Size | Ratio |
|-----------|---------------|-------|
| 1200x800 | 150x50 - 240x80 | ~12-20% of width |
| 1920x1080 | 230x77 - 384x128 | ~12-20% of width |
| 3840x2160 | 460x153 - 768x256 | ~12-20% of width |

**Example Watermark Creation (using Sharp):**

```typescript
import sharp from 'sharp';

// Create semi-transparent watermark
await sharp('logo.png')
  .resize(200, null, { fit: 'inside' })
  .composite([
    {
      input: Buffer.from([255, 255, 255, 128]), // 50% transparent white overlay
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: 'dest-in',
    },
  ])
  .png()
  .toFile('watermark-50opacity.png');
```

### Performance Optimization

**For Batch Processing:**
- Set higher `concurrency` (4-8) for multiple CPU cores
- Pre-load watermark as Buffer, reuse across images
- Use streams for very large images (> 20 MB)

**For Single Images:**
- Keep `concurrency: 1` to reduce overhead
- Use Buffer processing for simplicity

### Memory Management

**Memory Usage Per Image:**
```
Memory ≈ Input Size × 3 + Watermark Size × 2
```

**Example:**
- Input: 10 MB photo
- Watermark: 100 KB logo
- Memory: ~(10 MB × 3) + (0.1 MB × 2) = ~30.2 MB

**For Large Images (> 50 MB):**
- Use Stream processing instead of Buffer
- Reduce concurrency to 1-2
- Process images sequentially instead of in parallel

## Troubleshooting

**Watermark Not Visible:**
- Ensure watermark has sufficient contrast with image
- Check watermark is not too small
- Verify watermark image has transparency (PNG format)

**Memory Errors:**
- Reduce `concurrency` value
- Use Stream processing for large images
- Process images in smaller batches

**Watermark Position Incorrect:**
- Verify gravity constant is correct
- Check watermark image dimensions
- Ensure watermark doesn't exceed image boundaries
