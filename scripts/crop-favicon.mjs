import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const input = path.join(__dirname, '..', 'public', 'favicon-renton.png');
const output = path.join(__dirname, '..', 'public', 'favicon-renton.png');

// Trim whitespace/transparency, then resize to 64x64 with padding so globe fills most of it
await sharp(input)
  .trim({ background: { r: 255, g: 255, b: 255, alpha: 0 }, threshold: 10 })
  .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(output + '.tmp.png');

// Replace original
import { rename } from 'fs/promises';
await rename(output + '.tmp.png', output);

console.log('Favicon cropped and resized to 64x64 ✅');
