import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { hasExpectedSignature } from '../service/fileSignature.js';

async function fileWith(bytes, name) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kyc-check-'));
  const file = path.join(dir, name);
  await writeFile(file, Buffer.from(bytes));
  return { file, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('an image with the right signature is accepted for its extension', async () => {
  const jpeg = await fileWith([0xff, 0xd8, 0xff, 0xe0, 0, 16], 'passport.jpg');
  const png = await fileWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0], 'licence.png');
  const pdf = await fileWith([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34], 'statement.pdf');
  try {
    assert.equal(await hasExpectedSignature(jpeg.file, 'passport.jpg'), true);
    assert.equal(await hasExpectedSignature(png.file, 'licence.png'), true);
    assert.equal(await hasExpectedSignature(pdf.file, 'statement.PDF'), true);
  } finally {
    await Promise.all([jpeg.cleanup(), png.cleanup(), pdf.cleanup()]);
  }
});

test('text or HTML renamed to an image or PDF is refused', async () => {
  const html = await fileWith(Buffer.from('<html><script>alert(1)</script></html>'), 'passport.jpg');
  const pdfNamedPng = await fileWith([0x25, 0x50, 0x44, 0x46, 0x2d], 'scan.png');
  try {
    assert.equal(await hasExpectedSignature(html.file, 'passport.jpg'), false);
    assert.equal(await hasExpectedSignature(pdfNamedPng.file, 'scan.png'), false);
  } finally {
    await Promise.all([html.cleanup(), pdfNamedPng.cleanup()]);
  }
});

test('a file too short to hold a signature, or with an unknown extension, is refused', async () => {
  const tiny = await fileWith([0xff], 'tiny.jpg');
  const exe = await fileWith([0x4d, 0x5a, 0x90, 0x00], 'setup.exe');
  try {
    assert.equal(await hasExpectedSignature(tiny.file, 'tiny.jpg'), false);
    assert.equal(await hasExpectedSignature(exe.file, 'setup.exe'), false);
  } finally {
    await Promise.all([tiny.cleanup(), exe.cleanup()]);
  }
});
