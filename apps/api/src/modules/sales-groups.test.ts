import {describe,expect,it} from 'vitest';
import {splitSalesRows, sortSalesRows, type AllocatedSalesRow} from './sales-groups.js';
const row:AllocatedSalesRow={order_no:'INV-001',needed_date:'2026-10-10',kitchen:'Dapur Contoh',admin:'Admin',product_name:'Ayam Potong',ordered_quantity:10,order_unit:'Potong',actual_weight_kg:9,unit_price:30000,total:270000,sources:'COOPERATIVE, VENDOR',allocations:[
  {source:'COOPERATIVE',vendor_id:null,vendor_name:null,quantity:3,cost_price:20000},
  {source:'VENDOR',vendor_id:'a',vendor_name:'Vendor A',quantity:2,cost_price:21000},
  {source:'VENDOR',vendor_id:'a',vendor_name:'Vendor A',quantity:1,cost_price:24000},
  {source:'VENDOR',vendor_id:'b',vendor_name:'Vendor B',quantity:3,cost_price:25000},
]};
describe('daily source and vendor reporting',()=>{
  it('merges batches from the same vendor and splits totals without duplicates',()=>{
    const rows=splitSalesRows([row]);
    expect(rows.map(r=>r.source_label)).toEqual(['Barang Koperasi','Vendor A','Vendor B']);
    expect(rows.map(r=>r.actual_weight_kg)).toEqual([3,3,3]);
    expect(rows.map(r=>r.total)).toEqual([90000,90000,90000]);
    expect(rows.reduce((sum,r)=>sum+Number(r.ordered_quantity),0)).toBe(10);
    expect(rows[1].unit_cost).toBe(22000);
  });
  it('keeps each day together, cooperative first then named vendors',()=>{
    const rows=splitSalesRows([{...row,needed_date:'2026-10-11',order_no:'INV-002'},row]);
    expect(rows.map(r=>[r.needed_date,r.source_label])).toEqual([
      ['2026-10-10','Barang Koperasi'],['2026-10-10','Vendor A'],['2026-10-10','Vendor B'],
      ['2026-10-11','Barang Koperasi'],['2026-10-11','Vendor A'],['2026-10-11','Vendor B'],
    ]);
    expect(rows.reduce((sum,r)=>sum+Number(r.total),0)).toBe(540000);
    expect(new Set(rows.map(r=>r.order_no)).size).toBe(2);
  });
  it('preserves cents, milligrams and ordered quantities across rounding',()=>{
    const rows=splitSalesRows([{...row,total:100.01,ordered_quantity:1,actual_weight_kg:1}]);
    expect(rows.reduce((sum,r)=>sum+Math.round(Number(r.total)*100),0)).toBe(10001);
    for(const field of ['ordered_quantity','actual_weight_kg'] as const) expect(rows.reduce((sum,r)=>sum+Math.round(Number(r[field])*1000),0)).toBe(1000);
    expect(rows.every(r=>Number(r.total)>=0)).toBe(true);
  });
  it('omits released allocations and keeps ordinary-unit quantities',()=>{
    const rows=splitSalesRows([{...row,order_unit:'Botol',ordered_quantity:4,actual_weight_kg:null,total:40000,allocations:row.allocations.map((a,i)=>({...a,quantity:i===0?0:i===3?2:1}))}]);
    expect(rows.map(r=>r.source_label)).toEqual(['Vendor A','Vendor B']);
    expect(rows.map(r=>r.ordered_quantity)).toEqual([2,2]);
    expect(rows.every(r=>r.actual_weight_kg===null)).toBe(true);
  });
  it('does not silently label historical missing allocations as cooperative',()=>{
    const rows=splitSalesRows([{...row,allocations:[]}]);
    expect(rows[0].source_label).toBe('Sumber Tidak Tercatat');
    expect(rows[0].total).toBe(row.total);
  });
  it('separates vendors with the same name by their ID',()=>{
    const rows=splitSalesRows([{...row,allocations:row.allocations.map(a=>({...a,vendor_name:'Nama Sama'}))}]);
    expect(rows).toHaveLength(3);
    expect(rows[1].source_key).not.toBe(rows[2].source_key);
    expect(sortSalesRows([...rows].reverse()).map(r=>r.source_key)).toEqual(rows.map(r=>r.source_key));
  });
});
