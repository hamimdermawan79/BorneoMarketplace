import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { boundedTotal, checkoutInput, MAX_TOTAL, priceInput, quantityInput, referenceNumber } from './order-input.js';

const productId='a4b311aa-27e5-4e85-9238-d2e5fc7d5a00';
const input={neededDate:'2026-10-01',idempotencyKey:'f7ce5b3f-631f-4935-89dd-76110c5fc5e0',items:[{adminProductId:productId,quantity:2}]};

describe('validasi pesanan dan harga',()=>{
  it.each([null,true,false,'',[],{},Infinity,NaN,0,-1,0.0001,1_000_001])('menolak jumlah tidak aman %s',value=>{
    expect(quantityInput.safeParse(value).success).toBe(false);
  });
  it.each([.001,.07,1.234,1_000_000,'300.000',' 0.015 '])('menerima jumlah dengan presisi stok %s',value=>{
    expect(quantityInput.parse(value)).toBe(Number(value));
  });
  it.each([null,true,'',1.999,-1,Infinity,1_000_000_001])('menolak harga tidak aman %s',value=>{
    expect(priceInput.safeParse(value).success).toBe(false);
  });
  it('menerima harga nol dan desimal dua digit',()=>{
    expect(priceInput.parse('0')).toBe(0);
    expect(priceInput.parse(9.99)).toBe(9.99);
  });
  it('menolak produk duplikat termasuk UUID dengan huruf besar',()=>{
    expect(checkoutInput.safeParse({...input,items:[...input.items,{adminProductId:productId.toUpperCase(),quantity:3}]}).success).toBe(false);
  });
  it('membatasi jumlah item yang dikirim sekaligus',()=>{
    expect(checkoutInput.safeParse({...input,items:Array.from({length:101},()=>input.items[0])}).success).toBe(false);
  });
  it('memastikan total tidak overflow kolom keuangan',()=>{
    expect(boundedTotal(MAX_TOTAL)).toBe(MAX_TOTAL);
    expect(()=>boundedTotal(MAX_TOTAL+1)).toThrow();
    expect(()=>boundedTotal(Infinity)).toThrow();
    expect(()=>boundedTotal(-1)).toThrow();
  });
  it('formats compact database references without truncating larger numbers',async()=>{
    const query=vi.fn().mockResolvedValueOnce({rows:[{number:'1'}]})
      .mockResolvedValueOnce({rows:[{number:'2'}]})
      .mockResolvedValueOnce({rows:[{number:'1000000'}]});
    const client={query} as unknown as Pick<PoolClient,'query'>;
    expect(await referenceNumber('ORD',client)).toBe('INV-000001');
    expect(await referenceNumber('REQ',client)).toBe('REQ-000002');
    expect(await referenceNumber('ORD',client)).toBe('INV-1000000');
    expect(query).toHaveBeenCalledWith("SELECT nextval('public.document_reference_seq')::text AS number");
  });
});
