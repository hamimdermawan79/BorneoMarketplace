import { z } from 'zod';
import { mapsUrlInput } from './input-validation.js';
export const optionalMapsUrlInput = z.preprocess(
  value => value == null || (typeof value === 'string' && !value.trim()) ? null : value,
  mapsUrlInput.nullable()
);
export const usernameInput = z.string().trim().toLowerCase().min(3).max(64)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'Username hanya boleh berisi huruf, angka, titik, tanda minus, atau garis bawah.');
export const optionalEmailInput = z.preprocess(
  value => value === '' || value == null ? null : value,
  z.string().trim().max(254).email().transform(value => value.toLowerCase()).nullable()
);
