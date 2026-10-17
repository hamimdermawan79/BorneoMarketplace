import {afterEach, describe, expect, it, vi} from 'vitest';
import {cartStorageKey, readBuyerCart, saveBuyerCart} from './buyer-cart';

const owner = {id: 'buyer-a', organizationId: 'kitchen-a'};
function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
  };
}
afterEach(() => vi.unstubAllGlobals());

describe('persistent buyer cart', () => {
  it('restores quantities on a new read after the page/browser is closed', () => {
    const storage = memoryStorage();
    expect(saveBuyerCart(owner, {rice: 2, oil: 1.125}, storage)).toBe(true);
    expect(readBuyerCart(owner, storage)).toEqual({rice: 2, oil: 1.125});
    const restored = readBuyerCart(owner, storage);
    restored.rice = 999;
    expect(readBuyerCart(owner, storage).rice).toBe(2);
  });

  it('isolates different accounts and kitchen assignments', () => {
    const storage = memoryStorage();
    saveBuyerCart(owner, {rice: 2}, storage);
    const other = {...owner, id: 'buyer-b'};
    expect(readBuyerCart(other, storage)).toEqual({});
    expect(readBuyerCart({...owner, organizationId: 'kitchen-b'}, storage)).toEqual({});
    saveBuyerCart(other, {oil: 3}, storage);
    expect(readBuyerCart(owner, storage)).toEqual({rice: 2});
    expect(readBuyerCart(other, storage)).toEqual({oil: 3});
    expect(cartStorageKey({id: 'a:b', organizationId: 'c'})).not.toBe(cartStorageKey({id: 'a', organizationId: 'b:c'}));
  });

  it('persists edits/removals and removes only this cart when emptied after checkout', () => {
    const storage = memoryStorage();
    storage.setItem('borneo_token', 'session-must-remain');
    const other = {...owner, id: 'buyer-b'};
    saveBuyerCart(other, {other: 1}, storage);
    saveBuyerCart(owner, {rice: 2, oil: 3}, storage);
    saveBuyerCart(owner, {rice: 4}, storage);
    expect(readBuyerCart(owner, storage)).toEqual({rice: 4});
    saveBuyerCart(owner, {}, storage);
    expect(storage.getItem(cartStorageKey(owner))).toBeNull();
    expect(storage.getItem('borneo_token')).toBe('session-must-remain');
    expect(readBuyerCart(other, storage)).toEqual({other: 1});
  });

  it('accepts only valid positive numeric quantities, not cached prices or credentials', () => {
    const storage = memoryStorage();
    storage.setItem(cartStorageKey(owner), JSON.stringify({version: 1, quantities: {
      rice: 1.125, zero: 0, negative: -1, text: '2', excessive: 1_000_001,
      precision: 0.0001, nil: null, price: {salePrice: 100}, constructor: 2,
    }, token: 'ignored', price: 999}));
    expect(readBuyerCart(owner, storage)).toEqual({rice: 1.125});
    saveBuyerCart(owner, {rice: 2, invalid: Infinity}, storage);
    expect(JSON.parse(storage.getItem(cartStorageKey(owner))!)).toEqual({version: 1, quantities: {rice: 2}});
  });

  it.each(['invalid JSON', 'null', '[]', '{"version":2,"quantities":{"rice":2}}', '{"version":1,"quantities":[2]}'])(
    'ignores malformed/unsupported draft: %s', raw => {
      const storage = memoryStorage();
      storage.setItem(cartStorageKey(owner), raw);
      expect(readBuyerCart(owner, storage)).toEqual({});
    },
  );

  it('does not crash when storage is blocked or full, and reports failed writes', () => {
    const fail = () => { throw new Error('Storage denied'); };
    const blocked = {getItem: fail, setItem: fail, removeItem: fail};
    expect(readBuyerCart(owner, blocked)).toEqual({});
    expect(saveBuyerCart(owner, {rice: 1}, blocked)).toBe(false);
    expect(saveBuyerCart(owner, {}, blocked)).toBe(false);
    vi.stubGlobal('window', Object.defineProperty({}, 'localStorage', {get: fail}));
    expect(readBuyerCart(owner)).toEqual({});
    expect(saveBuyerCart(owner, {rice: 1})).toBe(false);
  });
});
