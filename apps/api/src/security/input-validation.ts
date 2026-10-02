import { randomBytes } from 'node:crypto';
import { z } from 'zod';

// Reject coercions such as null/true/blank strings, and values PostgreSQL would round.
export function decimalInput(scale: number, max: number, positive = false) {
  return z.preprocess(value => typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
    z.number().finite().min(positive ? 10 ** -scale : 0).max(max)
      .refine(value => Number(value.toFixed(scale)) === value, `Maksimal ${scale} angka di belakang koma.`));
}

export const priceInput = decimalInput(2, 999_999_999_999.99);
export const quantityInput = decimalInput(3, 99_999_999_999.999, true);
export const estimatedWeightInput = decimalInput(4, 99_999_999.9999, true);
export const passwordInput = z.string().min(8).max(72)
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password maksimal 72 byte.');

export const mapsUrlInput = z.string().trim().max(2048).url().refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && (
      ['maps.app.goo.gl', 'maps.google.com', 'maps.google.co.id'].includes(url.hostname) ||
      (['google.com', 'www.google.com', 'google.co.id', 'www.google.co.id', 'goo.gl'].includes(url.hostname) && /^\/maps(?:\/|$)/.test(url.pathname))
    );
  } catch { return false; }
}, 'Gunakan tautan HTTPS Google Maps yang valid.');

function isRasterImage(value: string) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 560_000 || bytes.toString('base64') !== match[2]) return false;
  if (match[1] === 'png') return bytes.length > 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (match[1] === 'jpeg') return bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217;
  return bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

export const productImageInput = z.string().trim().max(750_000).refine(value => {
  if (value.startsWith('data:')) return isRasterImage(value);
  // File names and private paths are assigned by the server, not the caller.
  return false;
}, 'Gunakan gambar PNG, JPEG atau WebP yang valid.');

export function generateTemporaryPassword() {
  return randomBytes(24).toString('base64url');
}
