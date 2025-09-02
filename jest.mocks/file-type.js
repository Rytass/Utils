// Mock for file-type v21 for Jest testing
const fileTypeFromBuffer = async (buffer) => {
  // Basic magic number detection for common file types
  if (!buffer || buffer.length < 4) {
    return undefined;
  }

  const bytes = buffer instanceof Buffer ? buffer : new Uint8Array(buffer);
  
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return { ext: 'png', mime: 'image/png' };
  }
  
  // JPEG
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  
  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { ext: 'gif', mime: 'image/gif' };
  }
  
  // WebP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && 
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  
  // Default fallback - return undefined for unknown file types (like original file-type)
  return undefined;
};

const fileTypeFromStream = async (stream) => {
  // Mock implementation for streams - read first chunk to detect file type
  return new Promise((resolve) => {
    const chunks = [];
    let totalLength = 0;
    let resolved = false;
    
    const resolveOnce = (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };
    
    stream.on('data', (chunk) => {
      if (resolved) return;
      
      chunks.push(chunk);
      totalLength += chunk.length;
      
      // Get first 32 bytes for magic number detection
      if (totalLength >= 32) {
        const buffer = Buffer.concat(chunks, Math.min(totalLength, 32));
        fileTypeFromBuffer(buffer).then(resolveOnce);
        return;
      }
    });
    
    stream.on('end', () => {
      if (resolved) return;
      
      if (chunks.length > 0) {
        const buffer = Buffer.concat(chunks);
        fileTypeFromBuffer(buffer).then(resolveOnce);
      } else {
        resolveOnce(undefined);
      }
    });
    
    stream.on('error', (err) => {
      resolveOnce(undefined);
    });
  });
};

const FileTypeResult = {};

module.exports = {
  fileTypeFromBuffer,
  fileTypeFromStream,
  FileTypeResult,
};