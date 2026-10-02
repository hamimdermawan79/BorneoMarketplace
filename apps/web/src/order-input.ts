export function validOrderQuantity(value: string, wholeUnits: boolean): boolean {
  if (!value.trim()) return false;
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 && quantity <= 1_000_000
    && (wholeUnits ? Number.isInteger(quantity) : Math.abs(quantity * 1000 - Math.round(quantity * 1000)) < 0.000001);
}

// Use the order snapshot, never the display spelling of a unit.
export function requiresActualWeight(item: { estimatedWeightKg: number | null }): boolean {
  return item.estimatedWeightKg != null;
}

type PricedItem = {
  id: string; quantity: number; unitPrice: number;
  estimatedWeightKg: number | null; actualWeightKg: number | null;
};

export function preparationTotal(items: PricedItem[], drafts: Record<string, string> = {}): number {
  const cents = items.reduce((sum, item) => {
    const draft = drafts[item.id];
    const amount = requiresActualWeight(item)
      ? (draft !== undefined && validOrderQuantity(draft, false)
        ? Number(draft) : Number(item.actualWeightKg ?? item.estimatedWeightKg))
      : Number(item.quantity);
    return sum + Math.round(amount * Number(item.unitPrice) * 100);
  }, 0);
  return cents / 100;
}
