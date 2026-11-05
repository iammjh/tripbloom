import { open } from 'node:fs/promises';
import path from 'node:path';

// First bytes that every file of each accepted type starts with.
const SIGNATURES = {
  '.jpg': [[0xff, 0xd8, 0xff]],
  '.jpeg': [[0xff, 0xd8, 0xff]],
  '.png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  '.pdf': [[0x25, 0x50, 0x44, 0x46, 0x2d]]
};

// True only when the file's bytes match the type its extension claims. The client's declared MIME type is not trusted.
export async function hasExpectedSignature(filePath, originalName) {
  const expected = SIGNATURES[path.extname(String(originalName || '')).toLowerCase()];
  if (!expected) return false;
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return expected.some(signature => bytesRead >= signature.length && signature.every((byte, index) => buffer[index] === byte));
  } finally {
    await handle.close();
  }
}
