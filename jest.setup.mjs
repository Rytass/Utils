// This file runs before Jest environment setup
// Use require for compatibility with Jest's early initialization
const { TextEncoder, TextDecoder } = require('util');

// Set up global polyfills before any modules load
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

// Also set on global for older Node.js versions
if (typeof global !== 'undefined') {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Additional crypto polyfills if needed
if (!globalThis.crypto) {
  globalThis.crypto = {
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  };
}