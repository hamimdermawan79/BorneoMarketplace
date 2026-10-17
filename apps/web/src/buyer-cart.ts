import {validOrderQuantity} from './order-input';

type CartOwner = {id: string; organizationId: string | null};
export type CartQuantities = Record<string, number>;
type CartStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const cartStorageKey = (owner: CartOwner) =>
  `borneo_cart:v1:${encodeURIComponent(owner.id)}:${encodeURIComponent(owner.organizationId ?? '')}`;

function cleanQuantities(value: unknown): CartQuantities {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, quantity]) =>
    id.length > 0 && id.length <= 128 && !['__proto__', 'constructor', 'prototype'].includes(id)
    && typeof quantity === 'number' && validOrderQuantity(String(quantity), false)));
}

export function readBuyerCart(owner: CartOwner, storage?: CartStorage): CartQuantities {
  try {
    const raw = (storage ?? window.localStorage).getItem(cartStorageKey(owner));
    if (!raw) return {};
    const saved = JSON.parse(raw);
    return saved?.version === 1 ? cleanQuantities(saved.quantities) : {};
  } catch {
    // Blocked storage or a malformed draft must not prevent opening the catalog.
    return {};
  }
}

export function saveBuyerCart(owner: CartOwner, quantities: CartQuantities, storage?: CartStorage): boolean {
  try {
    const target = storage ?? window.localStorage;
    const clean = cleanQuantities(quantities);
    const key = cartStorageKey(owner);
    if (Object.keys(clean).length) {
      // Never persist price, stock, or credentials. The API remains authoritative.
      target.setItem(key, JSON.stringify({version: 1, quantities: clean}));
    } else {
      target.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}
