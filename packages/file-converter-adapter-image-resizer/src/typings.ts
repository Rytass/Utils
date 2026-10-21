export interface ImageResizerOptions {
  maxWidth?: number;
  maxHeight?: number;
  keepAspectRatio?: boolean;
  /**
   * Number of libvips threads used to process each image (`sharp.concurrency`).
   * This is a process-wide setting and is only changed when provided.
   */
  concurrency?: number;
  /**
   * Do not process input images where the number of pixels (width x height) exceeds this limit.
   * For animated images the limit applies to all frames combined.
   * Defaults to sharp's built-in limit (0x3FFF x 0x3FFF); `false` disables the check.
   */
  limitInputPixels?: number | boolean;
}
