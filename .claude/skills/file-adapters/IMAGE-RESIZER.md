# ImageResizer Complete Reference

Complete API reference for `@rytass/file-converter-adapter-image-resizer`.

## Overview

ImageResizer provides intelligent image resizing capabilities while maintaining or controlling aspect ratios. Built on Sharp image processing library, it supports both Buffer and Stream processing for efficient memory usage.

**Key Features:**
- Resize images to maximum width/height (縮放至最大寬高)
- Maintain or control aspect ratio (保持或控制縱橫比)
- Prevent image enlargement (防止圖片放大)
- Parallel processing support (並發處理支援)
- Memory-efficient stream processing (記憶體高效串流處理)

## Installation

```bash
npm install @rytass/file-converter-adapter-image-resizer
```

**Dependencies:**
- `@rytass/file-converter` ^0.1.5
- `sharp` ^0.34.5

## Constructor

### `new ImageResizer(options: ImageResizerOptions)`

Creates a new ImageResizer instance with specified configuration.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options` | `ImageResizerOptions` | Yes | Resizer configuration object |

**ImageResizerOptions Properties:**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `maxWidth` | `number` | Conditional | `undefined` | Maximum output width in pixels (最大輸出寬度). At least one of `maxWidth` or `maxHeight` must be specified. |
| `maxHeight` | `number` | Conditional | `undefined` | Maximum output height in pixels (最大輸出高度). At least one of `maxWidth` or `maxHeight` must be specified. |
| `keepAspectRatio` | `boolean` | No | `true` | Whether to maintain the original aspect ratio (是否保持原始縱橫比). When `true`, uses `fit: 'inside'`. When `false`, uses `fit: 'cover'` (may crop). |
| `concurrency` | `number` | No | `1` | Number of threads for Sharp processing (Sharp 處理執行緒數). Use 4-8 for multi-core systems. |

**Validation Rules:**
- At least one of `maxWidth` or `maxHeight` must be provided
- If both are provided, image is resized to fit within both constraints
- All values must be positive numbers

**Example:**

```typescript
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';

// Resize to max 800x600, maintain aspect ratio
const resizer = new ImageResizer({
  maxWidth: 800,
  maxHeight: 600,
  keepAspectRatio: true,
  concurrency: 4,
});

// Width only - height calculated automatically
const widthOnlyResizer = new ImageResizer({
  maxWidth: 1200,
});

// Height only - width calculated automatically
const heightOnlyResizer = new ImageResizer({
  maxHeight: 800,
});

// Crop to exact dimensions (may lose content)
const cropResizer = new ImageResizer({
  maxWidth: 400,
  maxHeight: 400,
  keepAspectRatio: false, // Crop to fit
});
```

## Methods

### `convert<Output extends ConvertableFile>(file: ConvertableFile): Promise<Output>`

Converts (resizes) an image file. The output type matches the input type (Buffer → Buffer, Stream → Stream).

**Generic Type Parameters:**

| Parameter | Description |
|-----------|-------------|
| `Output` | Output type, must be either `Buffer` or `Readable` (Stream) |

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file` | `ConvertableFile` (Buffer \| Readable) | Input image file as Buffer or Stream |

**Returns:** `Promise<Output>`

- Returns `Promise<Buffer>` when input is Buffer
- Returns `Promise<Readable>` when input is Stream

**Behavior:**
- **Does NOT enlarge images**: If image is smaller than max dimensions, it returns original size
- **Maintains aspect ratio** (when `keepAspectRatio: true`): Scales image proportionally to fit within constraints
- **Crops to fit** (when `keepAspectRatio: false`): May crop image to exactly match dimensions

**Examples:**

#### Buffer Input/Output

```typescript
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { readFileSync, writeFileSync } from 'fs';

const resizer = new ImageResizer({
  maxWidth: 800,
  maxHeight: 600,
  keepAspectRatio: true,
});

// Read as Buffer
const inputBuffer = readFileSync('photo.jpg');

// Convert (returns Buffer)
const outputBuffer = await resizer.convert<Buffer>(inputBuffer);

// Write result
writeFileSync('photo-resized.jpg', outputBuffer);
```

#### Stream Input/Output

```typescript
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { createReadStream, createWriteStream } from 'fs';
import { Readable } from 'stream';

const resizer = new ImageResizer({
  maxWidth: 1920,
  maxHeight: 1080,
});

// Read as Stream
const inputStream = createReadStream('large-photo.jpg');

// Convert (returns Stream)
const outputStream = await resizer.convert<Readable>(inputStream);

// Pipe to output file
outputStream.pipe(createWriteStream('large-photo-resized.jpg'));

// Wait for completion
await new Promise((resolve, reject) => {
  outputStream.on('finish', resolve);
  outputStream.on('error', reject);
});
```

## Options Explained

### maxWidth & maxHeight

Define the maximum dimensions for the output image. The resizer will never exceed these bounds.

**Behavior Matrix:**

| Original Size | maxWidth | maxHeight | keepAspectRatio | Result Size |
|--------------|----------|-----------|-----------------|-------------|
| 1600x1200 | 800 | 600 | true | 800x600 |
| 1600x1200 | 800 | - | true | 800x600 (height auto-calculated) |
| 1600x1200 | - | 600 | true | 800x600 (width auto-calculated) |
| 800x600 | 1600 | 1200 | true | 800x600 (no enlargement) |
| 1600x900 | 800 | 800 | true | 800x450 (fit inside) |
| 1600x900 | 800 | 800 | false | 800x800 (cropped) |

**Examples:**

```typescript
// Landscape to portrait constraints
const resizer1 = new ImageResizer({ maxWidth: 600, maxHeight: 800 });
// Input: 1600x900 → Output: 600x338 (maintains landscape ratio)

// Square constraints with aspect ratio
const resizer2 = new ImageResizer({ maxWidth: 500, maxHeight: 500, keepAspectRatio: true });
// Input: 1600x900 → Output: 500x281 (maintains ratio, no crop)

// Square constraints without aspect ratio (crop mode)
const resizer3 = new ImageResizer({ maxWidth: 500, maxHeight: 500, keepAspectRatio: false });
// Input: 1600x900 → Output: 500x500 (cropped to square)
```

### keepAspectRatio

Controls how the image is fitted within the maximum dimensions.

#### `keepAspectRatio: true` (Default)

Uses Sharp's `fit: 'inside'` strategy:
- Image is scaled down to fit **completely** within bounds
- No cropping occurs
- Entire image visible
- Output may be smaller than max dimensions to maintain ratio

```typescript
const maintainRatio = new ImageResizer({
  maxWidth: 800,
  maxHeight: 600,
  keepAspectRatio: true,
});

// Example: 1600x1200 → 800x600 (scaled down proportionally)
// Example: 1600x900 → 800x450 (width maxed, height auto-calculated)
// Example: 900x1200 → 450x600 (height maxed, width auto-calculated)
```

#### `keepAspectRatio: false`

Uses Sharp's `fit: 'cover'` strategy:
- Image is scaled to **cover** the entire bounds
- Cropping occurs if aspect ratios don't match
- Output always matches max dimensions exactly
- Some content may be lost

```typescript
const cropToFit = new ImageResizer({
  maxWidth: 800,
  maxHeight: 600,
  keepAspectRatio: false,
});

// Example: 1600x1200 → 800x600 (exact match, no crop)
// Example: 1600x900 → 800x600 (excess width cropped)
// Example: 900x1200 → 800x600 (excess height cropped)
```

**Visual Comparison:**

```
Original: 1600x900 (16:9 ratio)
Target:   800x800

keepAspectRatio: true       keepAspectRatio: false
┌─────────────────┐         ┌─────────────────┐
│                 │         │█████████████████│ ← Image covers
│  ┌───────────┐  │         │█████████████████│   entire area
│  │  800x450  │  │         │█████████████████│
│  └───────────┘  │         │█████████████████│ ← Top/bottom
│                 │         │█████████████████│   cropped
└─────────────────┘         └─────────────────┘
Fits inside, full image     Covers area, cropped
Output: 800x450             Output: 800x800
```

### concurrency

Controls the number of threads Sharp uses for image processing.

**Recommendations:**

| System | Recommended Value | Reason |
|--------|------------------|---------|
| Single-core | 1 (default) | No benefit from parallelization |
| Dual-core | 2 | Match CPU cores |
| Quad-core | 4 | Match CPU cores |
| 8+ cores | 4-8 | Diminishing returns beyond 8 |
| Batch processing | CPU cores | Maximum throughput |
| Single image | 1-2 | Lower overhead |

```typescript
// For batch processing on quad-core system
const batchResizer = new ImageResizer({
  maxWidth: 800,
  concurrency: 4, // Match CPU cores
});

// For single image processing
const singleResizer = new ImageResizer({
  maxWidth: 800,
  concurrency: 1, // Lower overhead
});
```

**Note:** Sharp's concurrency setting is global and affects all Sharp instances after being set.

## Use Cases

### Fixed Width, Auto Height

Resize images to a consistent width, letting height adjust automatically:

```typescript
const thumbnailGenerator = new ImageResizer({
  maxWidth: 300,
  keepAspectRatio: true,
});

// 1600x1200 → 300x225
// 1600x900  → 300x169
// 900x1600  → 300x533
```

**Use for:**
- Blog post thumbnails (部落格縮圖)
- Product listing images (商品列表圖片)
- Social media previews (社群媒體預覽)

### Fixed Height, Auto Width

Resize images to a consistent height, letting width adjust automatically:

```typescript
const bannerResizer = new ImageResizer({
  maxHeight: 400,
  keepAspectRatio: true,
});

// 1600x1200 → 533x400
// 1600x900  → 711x400
// 900x1600  → 225x400
```

**Use for:**
- Header banners (頁首橫幅)
- Carousel slides (輪播圖片)
- Gallery rows (圖庫行列)

### Constrain to Maximum Dimensions

Ensure images never exceed certain dimensions in either direction:

```typescript
const webOptimizer = new ImageResizer({
  maxWidth: 1920,
  maxHeight: 1080,
  keepAspectRatio: true,
});

// 3840x2160 (4K) → 1920x1080 (Full HD)
// 1600x900        → 1600x900 (unchanged, already within bounds)
// 2400x1600       → 1620x1080 (height constrained)
```

**Use for:**
- Web optimization (網頁優化)
- Email attachments (電子郵件附件)
- Mobile app images (手機應用程式圖片)

### Square Crop

Create square thumbnails by cropping to fit:

```typescript
const profilePicProcessor = new ImageResizer({
  maxWidth: 200,
  maxHeight: 200,
  keepAspectRatio: false, // Enable cropping
});

// 1600x1200 → 200x200 (center cropped)
// 1600x900  → 200x200 (top/bottom cropped)
// 900x1600  → 200x200 (left/right cropped)
```

**Use for:**
- Profile pictures (頭像)
- Avatar images (使用者圖示)
- Icon generation (圖示生成)

## Complete Example

### E-commerce Product Image Processor

```typescript
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { basename, join } from 'path';

// Create different resizers for different purposes
const resizers = {
  // Large product display (1200x1200 max)
  large: new ImageResizer({
    maxWidth: 1200,
    maxHeight: 1200,
    keepAspectRatio: true,
    concurrency: 4,
  }),

  // Medium product listing (600x600 max)
  medium: new ImageResizer({
    maxWidth: 600,
    maxHeight: 600,
    keepAspectRatio: true,
    concurrency: 4,
  }),

  // Small thumbnail (200x200 max)
  thumbnail: new ImageResizer({
    maxWidth: 200,
    maxHeight: 200,
    keepAspectRatio: true,
    concurrency: 4,
  }),

  // Square thumbnail (cropped)
  square: new ImageResizer({
    maxWidth: 200,
    maxHeight: 200,
    keepAspectRatio: false, // Crop to square
    concurrency: 4,
  }),
};

// Process all product images
async function processProductImages() {
  // Find all product photos
  const images = await glob('products/**/*.{jpg,jpeg,png}');

  console.log(`Found ${images.length} product images to process`);

  for (const imagePath of images) {
    const fileName = basename(imagePath);
    const fileNameNoExt = fileName.replace(/\.(jpg|jpeg|png)$/i, '');

    console.log(`Processing: ${fileName}`);

    // Read original image
    const original = readFileSync(imagePath);

    try {
      // Generate all sizes
      const large = await resizers.large.convert<Buffer>(original);
      const medium = await resizers.medium.convert<Buffer>(original);
      const thumbnail = await resizers.thumbnail.convert<Buffer>(original);
      const square = await resizers.square.convert<Buffer>(original);

      // Save to different directories
      writeFileSync(join('output/large', `${fileNameNoExt}.jpg`), large);
      writeFileSync(join('output/medium', `${fileNameNoExt}.jpg`), medium);
      writeFileSync(join('output/thumbnail', `${fileNameNoExt}.jpg`), thumbnail);
      writeFileSync(join('output/square', `${fileNameNoExt}.jpg`), square);

      console.log(`✓ Processed: ${fileName}`);
    } catch (error) {
      console.error(`✗ Failed: ${fileName}`, error);
    }
  }

  console.log('All product images processed!');
}

// Run processing
processProductImages().catch(console.error);
```

### Responsive Image Generator

```typescript
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { readFileSync, writeFileSync } from 'fs';

// Generate responsive image sizes (1x, 2x, 3x)
async function generateResponsiveImages(inputPath: string, baseWidth: number) {
  const original = readFileSync(inputPath);
  const baseName = inputPath.replace(/\.(jpg|jpeg|png)$/, '');

  // 1x size
  const resizer1x = new ImageResizer({ maxWidth: baseWidth });
  const image1x = await resizer1x.convert<Buffer>(original);
  writeFileSync(`${baseName}@1x.jpg`, image1x);

  // 2x size (for retina displays)
  const resizer2x = new ImageResizer({ maxWidth: baseWidth * 2 });
  const image2x = await resizer2x.convert<Buffer>(original);
  writeFileSync(`${baseName}@2x.jpg`, image2x);

  // 3x size (for high-DPI displays)
  const resizer3x = new ImageResizer({ maxWidth: baseWidth * 3 });
  const image3x = await resizer3x.convert<Buffer>(original);
  writeFileSync(`${baseName}@3x.jpg`, image3x);

  console.log(`Generated responsive images for ${inputPath}`);
}

// Generate 400px base width with 2x and 3x versions
await generateResponsiveImages('hero-image.jpg', 400);
// Output: hero-image@1x.jpg (400px)
//         hero-image@2x.jpg (800px)
//         hero-image@3x.jpg (1200px)
```

### Memory-Efficient Batch Processing

```typescript
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { createReadStream, createWriteStream } from 'fs';
import { Readable } from 'stream';
import { glob } from 'glob';
import { basename } from 'path';

// Process large images using streams to avoid memory issues
async function processLargeImages() {
  const resizer = new ImageResizer({
    maxWidth: 1920,
    maxHeight: 1080,
    keepAspectRatio: true,
    concurrency: 2, // Lower concurrency for large files
  });

  const images = await glob('large-photos/**/*.jpg');

  for (const imagePath of images) {
    console.log(`Processing: ${basename(imagePath)}`);

    // Use streams for memory efficiency
    const inputStream = createReadStream(imagePath);
    const outputStream = await resizer.convert<Readable>(inputStream);

    const outputPath = `output/${basename(imagePath)}`;
    const writeStream = createWriteStream(outputPath);

    // Pipe and wait for completion
    await new Promise<void>((resolve, reject) => {
      outputStream.pipe(writeStream);
      writeStream.on('finish', () => {
        console.log(`✓ Completed: ${basename(imagePath)}`);
        resolve();
      });
      writeStream.on('error', reject);
    });
  }

  console.log('All large images processed!');
}

processLargeImages().catch(console.error);
```

## Performance Considerations

### Buffer vs Stream

| File Size | Recommended Approach | Reason |
|-----------|---------------------|---------|
| < 5 MB | Buffer | Faster, simpler code |
| 5-20 MB | Either | Depends on available memory |
| > 20 MB | Stream | Avoid memory exhaustion |

### Concurrency Settings

| Scenario | Concurrency | Reason |
|----------|-------------|---------|
| Single large file | 1-2 | Reduce memory pressure |
| Batch small files | 4-8 | Maximize throughput |
| Production server | CPU cores / 2 | Balance with other processes |
| Development | 1-2 | Easier debugging |

### Memory Usage

Approximate memory usage per image being processed:

```
Memory = Input Size × 3 + Output Size × 3
```

Example: Processing a 10 MB image to 3 MB output:
```
Memory ≈ (10 MB × 3) + (3 MB × 3) = 39 MB
```

For batch processing with concurrency 4:
```
Total Memory ≈ 39 MB × 4 = 156 MB
```

**Recommendations:**
- Monitor memory usage with `process.memoryUsage()`
- Use streams for files > 20 MB
- Reduce concurrency if experiencing OOM errors
- Process in batches instead of all at once
