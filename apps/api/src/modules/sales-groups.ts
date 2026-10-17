type Numeric = number | string;
export type SalesRow = {
  order_no: string; needed_date: string | Date; kitchen: string; admin: string;
  product_name: string; ordered_quantity: Numeric; order_unit: string;
  actual_weight_kg: Numeric | null; unit_price: Numeric; total: Numeric; sources: string;
  unit_cost?: Numeric; source_key?: string; source_label?: string;
};
export type Allocation = {source: 'COOPERATIVE' | 'VENDOR'; vendor_id: string | null; vendor_name: string | null; quantity: Numeric; cost_price: Numeric | null};
export type AllocatedSalesRow = SalesRow & {allocations: Allocation[]};
const dayFormatter = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Jakarta'});
export const salesDay = (value: string | Date) => dayFormatter.format(new Date(value));
export const salesSourceKey = (row: SalesRow) => row.source_key ?? row.sources;
export const salesSourceLabel = (row: SalesRow) => row.source_label ?? (row.sources === 'COOPERATIVE' ? 'Barang Koperasi' : 'Vendor Tidak Tercatat');
const compare = (a: string, b: string) => a.localeCompare(b, 'id-ID', {numeric: true});

export function sortSalesRows<T extends SalesRow>(rows: T[]): T[] {
  return rows.map(row => ({row, day: salesDay(row.needed_date)})).sort(({row:a,day:dayA}, {row:b,day:dayB}) => compare(dayA, dayB)
    || Number(b.sources === 'COOPERATIVE') - Number(a.sources === 'COOPERATIVE')
    || compare(salesSourceLabel(a), salesSourceLabel(b)) || compare(salesSourceKey(a), salesSourceKey(b))
    || compare(a.order_no, b.order_no) || compare(a.product_name, b.product_name)).map(entry => entry.row);
}

// Apportion integer units using largest remainders. No duplicated revenue or lost cents.
function portions(value: Numeric, weights: bigint[], precision: number): number[] {
  const scale = 10 ** precision;
  const units = BigInt(Math.round(Number(value) * scale));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0n);
  const parts = weights.map(weight => units * weight / totalWeight);
  const remainders = weights.map((weight, index) => ({index, value: units * weight % totalWeight}))
    .sort((a, b) => a.value === b.value ? a.index - b.index : a.value > b.value ? -1 : 1);
  const remaining = Number(units - parts.reduce((sum, part) => sum + part, 0n));
  for (let i = 0; i < remaining; i++) parts[remainders[i].index]++;
  return parts.map(part => Number(part) / scale);
}

export function splitSalesRows(rows: AllocatedSalesRow[]): SalesRow[] {
  const result = rows.flatMap(({allocations, ...row}) => {
    const groups = new Map<string, {key: string; label: string; source: string; weight: bigint; cost: number}>();
    for (const allocation of allocations) {
      const weight = BigInt(Math.round(Number(allocation.quantity) * 1000));
      if (weight <= 0n) continue; // Released reservations are not shipped goods.
      const cooperative = allocation.source === 'COOPERATIVE';
      const key = cooperative ? 'COOPERATIVE' : `VENDOR:${allocation.vendor_id ?? 'unknown'}`;
      const group = groups.get(key) ?? {key, label: cooperative ? 'Barang Koperasi' : allocation.vendor_name?.trim() || 'Vendor Tidak Tercatat', source: allocation.source, weight: 0n, cost: 0};
      group.weight += weight;
      group.cost += Number(allocation.quantity) * Number(allocation.cost_price ?? 0);
      groups.set(key, group);
    }
    const entries = [...groups.values()].sort((a, b) => Number(b.source === 'COOPERATIVE') - Number(a.source === 'COOPERATIVE') || compare(a.label, b.label) || compare(a.key, b.key));
    if (!entries.length) return [{...row, source_key: 'UNRECORDED', source_label: 'Sumber Tidak Tercatat'}];
    const weights = entries.map(group => group.weight);
    const quantities = portions(row.ordered_quantity, weights, 3);
    const actuals = row.actual_weight_kg == null ? null : portions(row.actual_weight_kg, weights, 3);
    const totals = portions(row.total, weights, 2);
    return entries.map((group, index) => ({...row, sources: group.source, source_key: group.key, source_label: group.label,
      ordered_quantity: quantities[index], actual_weight_kg: actuals?.[index] ?? null, total: totals[index],
      unit_cost: group.cost / (Number(group.weight) / 1000)}));
  });
  return sortSalesRows(result);
}
