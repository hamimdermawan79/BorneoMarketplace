import {describe,expect,it} from 'vitest';
import {canTransition,lineTotal,requiredStock,stockPrecision} from './order-rules.js';
describe('aturan pesanan',()=>{
  it('mengubah butir telur menjadi estimasi kilogram',()=>expect(requiredStock({weighing_required:true,estimated_kg_per_unit:.06},100)).toBe(6));
  it('mempertahankan jumlah produk biasa',()=>expect(requiredStock({weighing_required:false,estimated_kg_per_unit:null},25)).toBe(25));
  it('membatasi transisi status',()=>{expect(canTransition('PREPARING','SHIPPED')).toBe(true);expect(canTransition('SUBMITTED','COMPLETED')).toBe(false)});
  it('menghitung nilai timbang aktual',()=>expect(lineTotal(30.6,38000)).toBe(1162800));
  it('menggunakan presisi stok database tanpa sisa floating point',()=>{
    expect(stockPrecision(.3-.1-.2)).toBe(0);
    expect(requiredStock({weighing_required:true,estimated_kg_per_unit:.1234},3)).toBe(.37);
  });
  it('tidak menghasilkan reservasi nol untuk estimasi positif kecil',()=>expect(requiredStock({weighing_required:true,estimated_kg_per_unit:.0001},1)).toBe(.001));
  it.each([0,-1,NaN,Infinity])('menolak estimasi berat tidak valid %s',value=>{
    expect(()=>requiredStock({weighing_required:true,estimated_kg_per_unit:value},10)).toThrow();
  });
});
