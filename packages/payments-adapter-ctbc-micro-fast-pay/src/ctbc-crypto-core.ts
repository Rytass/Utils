import crypto from 'node:crypto';

const IV = Buffer.alloc(8, 0); // 8 bytes for DES

const xorBuffers = (buf1: Buffer, buf2: Buffer): Buffer => {
  const len = Math.min(buf1.length, buf2.length);
  const result = Buffer.allocUnsafe(len);

  for (let i = 0; i < len; i++) {
    result[i] = buf1[i] ^ buf2[i];
  }

  return result;
};

const pkcs5Pad = (buf: Buffer, blockSize: number) => {
  const pad = blockSize - (buf.length % blockSize);

  return Buffer.concat([buf, Buffer.alloc(pad, pad)]);
};

const pkcs5UnPad = (buf: Buffer): Buffer => {
  const pad = buf[buf.length - 1];

  if (pad <= 0 || pad > buf.length) throw new Error('Invalid PKCS#5 padding');

  return Buffer.from(buf.subarray(0, buf.length - pad));
};

export function encrypt3DES(
  text: string | Buffer,
  key: Buffer,
  padding = true,
): Buffer {
  const cipher = crypto.createCipheriv('des-ede3-cbc', key, IV);

  cipher.setAutoPadding(false);

  const inputBuffer =
    typeof text === 'string' ? Buffer.from(text, 'utf8') : text;

  const input = padding ? pkcs5Pad(inputBuffer, 8) : inputBuffer;

  return Buffer.concat([cipher.update(input), cipher.final()]);
}

export function decrypt3DES(
  encrypted: Buffer,
  key: Buffer,
): string {
  const decipher = crypto.createDecipheriv('des-ede3-cbc', key, IV);

  decipher.setAutoPadding(false);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return pkcs5UnPad(decrypted).toString('utf8');
}

export function getDivKey(key: string): Buffer {
  const hash = crypto.createHash('sha256').update(key).digest('hex');

  const leftKey = hash.slice(0, 32);
  const rightKey = hash.slice(-32);

  const xorKey = xorBuffers(
    Buffer.from(leftKey, 'hex'),
    Buffer.from(rightKey, 'hex'),
  );

  const divKey = Buffer.concat([xorKey, Buffer.from(xorKey.subarray(0, 8))]);

  return divKey;
}

export function getTXN(input: string, key: string): string {
  const divKey = getDivKey(key);

  const encrypted = encrypt3DES(input, divKey, true);

  return encrypted.toString('hex').toUpperCase();
}

export function getMAC(input: string, key: string): string {
  const divKey = getDivKey(key);

  const encrypted = encrypt3DES(input, divKey, true);
  const sha = crypto.createHash('sha256').update(encrypted).digest();
  const finalEnc = encrypt3DES(sha, divKey, false);

  return finalEnc.toString('hex').toUpperCase().slice(-8); // Last 8 characters (4 bytes)
}

export function getDecTXN(input: string, key: string): string {
  const divKey = getDivKey(key);

  const decrypted = decrypt3DES(Buffer.from(input, 'hex'), divKey);

  return decrypted;
}
