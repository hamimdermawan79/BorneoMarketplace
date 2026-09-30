import {describe,expect,it} from 'vitest';
import {canTransition,lineTotal,requiredStock} from './order-rules.js';
describe('aturan pesanan',()=>{
  it('mengubah butir telur menjadi estimasi kilogram',()=>expect(requiredStock({weighing_required:true,estimated_kg_per_unit:.06},100)).toBe(6));
  it('mempertahankan jumlah produk biasa',()=>expect(requiredStock({weighing_required:false,estimated_kg_per_unit:null},25)).toBe(25));
  it('membatasi transisi status',()=>{expect(canTransition('PREPARING','SHIPPED')).toBe(true);expect(canTransition('SUBMITTED','COMPLETED')).toBe(false)});
  it('menghitung nilai timbang aktual',()=>expect(lineTotal(30.6,38000)).toBe(1162800));
});
