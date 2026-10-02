import { describe, expect, it } from 'vitest';
import { validOrderQuantity, requiresActualWeight, preparationTotal } from './order-input';

describe('order quantity editing', () => {
  it('allows a blank draft without accepting it as an order', () => {
    for (const value of ['', ' ', '0', '-1', 'NaN', 'Infinity', '1000001']) {
      expect(validOrderQuantity(value, false)).toBe(false);
    }
    expect(validOrderQuantity('12', true)).toBe(true);
    expect(validOrderQuantity('0.125', false)).toBe(true);
    expect(validOrderQuantity('1.5', true)).toBe(false);
    expect(validOrderQuantity('1.0001', false)).toBe(false);
  });
});

describe('actual weight', () => {
  it('uses the order snapshot regardless of unit capitalization', () => {
    for (const orderUnit of ['Potong', 'potong', 'pcs', 'PCS', 'butir']) {
      const item = { orderUnit, estimatedWeightKg: 80 };
      expect(requiresActualWeight(item)).toBe(true);
    }
    expect(requiresActualWeight({ estimatedWeightKg: null })).toBe(false);
  });
});

describe('preparation pricing', () => {
  const items = [
    { id: 'chicken', quantity: 100, unitPrice: 30000, estimatedWeightKg: 80, actualWeightKg: null },
    { id: 'eggs', quantity: 100, unitPrice: 21000, estimatedWeightKg: 6, actualWeightKg: null },
    { id: 'sauce', quantity: 2, unitPrice: 15000, estimatedWeightKg: null, actualWeightKg: null },
  ];
  it('initially uses estimated kg and ordinary product quantities', () => {
    expect(preparationTotal(items)).toBe(2556000);
  });
  it('updates immediately when actual kg are typed, without using pcs/potong for price', () => {
    expect(preparationTotal(items, { chicken: '70', eggs: '5' })).toBe(2235000);
  });
  it('retains persisted actual kg after reload and recalculates subsequent edits', () => {
    const saved = items.map(item => item.id === 'chicken' ? { ...item, actualWeightKg: 70 } : item);
    expect(preparationTotal(saved)).toBe(2256000);
    expect(preparationTotal(saved, { chicken: '75' })).toBe(2406000);
    expect(preparationTotal(saved, { chicken: '' })).toBe(2256000);
  });
});
