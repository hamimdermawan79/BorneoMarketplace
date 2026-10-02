import type { PoolClient } from 'pg';
import { z } from 'zod';

export const MAX_QUANTITY = 1_000_000;
export const MAX_PRICE = 1_000_000_000;
export const MAX_TOTAL = 999_999_999_999.99;

function decimalInput(places: number, max: number, minimum: number) {
  return z.union([z.number(), z.string().trim().regex(/^\d+(?:\.\d+)?$/)])
    .transform(Number)
    .pipe(z.number().finite().min(minimum).max(max))
    .refine(value => {
      const scaled = value * 10 ** places;
      return Math.abs(scaled - Math.round(scaled)) <= Number.EPSILON * Math.max(1, scaled) * 4;
    }, `Gunakan paling banyak ${places} angka desimal.`);
}

export const quantityInput = decimalInput(3, MAX_QUANTITY, 0.001);
export const priceInput = decimalInput(2, MAX_PRICE, 0);

export const checkoutInput = z.object({
  neededDate: z.string().date(),
  note: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().uuid(),
  items: z.array(z.object({ adminProductId: z.string().uuid(), quantity: quantityInput })).min(1).max(100),
}).refine(value => new Set(value.items.map(item => item.adminProductId.toLowerCase())).size === value.items.length, {
  path: ['items'], message: 'Produk yang sama hanya boleh dicantumkan sekali.',
});

export async function referenceNumber(prefix: 'ORD' | 'REQ', client: Pick<PoolClient, 'query'>) {
  const { rows } = await client.query("SELECT nextval('public.document_reference_seq')::text AS number");
  return `${prefix === 'ORD' ? 'INV' : prefix}-${rows[0].number.padStart(6, '0')}`;
}

export function boundedTotal(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > MAX_TOTAL) {
    throw Object.assign(new Error('Total pesanan melebihi batas yang didukung.'), { statusCode: 400 });
  }
  return Math.round(value * 100) / 100;
}
