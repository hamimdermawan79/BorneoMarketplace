import { describe, expect, it } from 'vitest';
import { generateTemporaryPassword, mapsUrlInput, passwordInput, priceInput, productImageInput, quantityInput } from './input-validation.js';

describe('untrusted management input', () => {
  it('rejects nonfinite numbers, implicit coercions and precision loss', () => {
    for (const input of [Infinity, NaN, null, true, '', ' ', 'Infinity', -1, 0.0001, 1e30]) {
      expect(quantityInput.safeParse(input).success).toBe(false);
    }
    expect(priceInput.safeParse('12.345').success).toBe(false);
    expect(priceInput.parse('12.34')).toBe(12.34);
    expect(quantityInput.parse('0.125')).toBe(0.125);
  });

  it('accepts only known maps HTTPS hosts and rejects executable links', () => {
    for (const input of ['javascript:alert(1)', 'https://maps.app.goo.gl.evil.test/x', 'https://evil.test/maps', 'https://maps.app.goo.gl@evil.test/x', 'http://maps.google.com/maps']) {
      expect(mapsUrlInput.safeParse(input).success).toBe(false);
    }
    expect(mapsUrlInput.safeParse('https://maps.app.goo.gl/abc123').success).toBe(true);
    expect(mapsUrlInput.safeParse('https://www.google.com/maps?q=Lumbang').success).toBe(true);
  });

  it('blocks SVG/HTML data, fake image content, remote trackers and traversal', () => {
    for (const input of ['javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,PHNjcmlwdD4=', '/assets/../../secret.png', 'https://evil.test/track.png', '//evil.test/a.png']) {
      expect(productImageInput.safeParse(input).success).toBe(false);
    }
    expect(productImageInput.safeParse('/assets/produk/telur.jpg').success).toBe(false);
    const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLAAAAABJRU5ErkJggg==';
    expect(productImageInput.safeParse(png).success).toBe(true);
  });

  it('bounds passwords by UTF8 bytes and creates distinct random credentials', () => {
    expect(passwordInput.safeParse('a'.repeat(73)).success).toBe(false);
    expect(passwordInput.safeParse('é'.repeat(37)).success).toBe(false);
    const credentials=Array.from({length:25},()=>generateTemporaryPassword());
    expect(new Set(credentials).size).toBe(25);
    for(const password of credentials){expect(password.length).toBeGreaterThanOrEqual(32);expect(passwordInput.safeParse(password).success).toBe(true);}
  });
});
