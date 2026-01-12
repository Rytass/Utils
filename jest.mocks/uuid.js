// Mock for uuid v13 for Jest testing
// uuid v13 is ESM-only, so we need a CommonJS-compatible mock

const crypto = require('crypto');

// Generate a v4 UUID
const v4 = () => {
  return crypto.randomUUID();
};

// Validate UUID
const validate = uuid => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
};

// Parse UUID to bytes
const parse = uuid => {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
};

// Stringify bytes to UUID
const stringify = bytes => {
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// NIL UUID
const NIL = '00000000-0000-0000-0000-000000000000';

// MAX UUID
const MAX = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

// Version detection
const version = uuid => {
  if (!validate(uuid)) return -1;
  return parseInt(uuid.charAt(14), 16);
};

module.exports = {
  v4,
  validate,
  parse,
  stringify,
  NIL,
  MAX,
  version,
  // Re-export for named imports
  default: { v4, validate, parse, stringify, NIL, MAX, version },
};
