export const SupportSources = ['jpg', 'png', 'webp', 'gif', 'avif', 'tif', 'svg'];

/**
 * Aliases this package's `targetFormat` accepts, mapped to the names sharp's
 * `FormatEnum` declares.
 *
 * sharp 0.35 tightened `FormatEnum` to the canonical keys, so `jpg` and `tif`
 * stopped type-checking — both still work at runtime, and both have always been
 * part of this package's public `targetFormat` union. Mapping them keeps that
 * union intact; narrowing it would be a breaking change for callers passing a
 * spelling that never stopped working.
 */
export const CANONICAL_FORMAT: Record<string, 'jpeg' | 'tiff'> = { jpg: 'jpeg', tif: 'tiff' };
