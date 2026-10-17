import {describe,expect,it,vi} from 'vitest';
import {OrderEdits,setAllocationPrepared,type Order} from './admin-order-updates';

const deferred=()=>{let resolve!:()=>void;let reject!:(error:Error)=>void;const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};};
describe('lightweight order edits',()=>{
  it('shows optimistic checklist state before saving and sends one operation',async()=>{
    const edits=new OrderEdits();const request=deferred();const work=vi.fn(()=>request.promise);
    const task=edits.save('allocation:a','order-a',true,work);
    expect(edits.value('allocation:a')).toBe(true);expect(edits.feedback(['order-a'])).toBe('Menyimpan…');
    expect(edits.save('allocation:a','order-a',false,work)).toBe(task);
    await Promise.resolve();expect(work).toHaveBeenCalledTimes(1);
    request.resolve();expect(await task).toBe(true);
    expect(edits.feedback(['order-a'])).toBe('Tersimpan');expect(edits.hasPending()).toBe(false);
  });
  it('rolls back the optimistic value on failure and allows a retry',async()=>{
    const edits=new OrderEdits();
    expect(await edits.save('allocation:a','order-a',true,async()=>{throw new Error('Tidak tersambung')})).toBe(false);
    expect(edits.value('allocation:a')).toBeUndefined();expect(edits.error(['order-a'])).toBe('Tidak tersambung');
    await expect(edits.wait(['order-a'])).rejects.toThrow('belum tersimpan');
    await edits.save('allocation:a','order-a',true,async()=>{});
    expect(edits.error(['order-a'])).toBe('');await expect(edits.wait(['order-a'])).resolves.toBeUndefined();
  });
  it('waits for checklist and weight saves, locks duplicate status actions and new edits',async()=>{
    const edits=new OrderEdits();const check=deferred();const weight=deferred();
    const first=edits.save('allocation:a','order-a',true,()=>check.promise);
    const second=edits.save('weight:b','order-b','2.5',()=>weight.promise);
    expect(edits.beginStatus(['order-a','order-b'])).toBe(true);
    expect(edits.beginStatus(['order-b'])).toBe(false);
    const forbidden=vi.fn(async()=>{});
    expect(await edits.save('allocation:new','order-a',true,forbidden)).toBe(false);expect(forbidden).not.toHaveBeenCalled();
    let ready=false;const waiting=edits.wait(['order-a','order-b']).then(()=>{ready=true});
    check.resolve();await first;expect(ready).toBe(false);
    weight.resolve();await second;await waiting;expect(ready).toBe(true);
    edits.endStatus(['order-a','order-b']);expect(edits.hasPending()).toBe(false);
  });
  it('preserves failures after waiting, so a failed save cannot be ignored on the next click',async()=>{
    const edits=new OrderEdits();const check=deferred();
    const task=edits.save('allocation:a','order-a',true,()=>check.promise);
    edits.beginStatus(['order-a']);const waiting=edits.wait(['order-a']);
    check.reject(new Error('Server menolak'));expect(await task).toBe(false);
    await expect(waiting).rejects.toThrow('belum tersimpan');
    edits.endStatus(['order-a']);await expect(edits.wait(['order-a'])).rejects.toThrow('belum tersimpan');
  });
  it('does not invalidate unrelated cards or wait for another kitchen',async()=>{
    const edits=new OrderEdits();const other=edits.snapshot(['other-order']);const deferredSave=deferred();
    const stop=edits.subscribe(vi.fn());
    const saving=edits.save('allocation:a','order-a',true,()=>deferredSave.promise);
    expect(edits.snapshot(['other-order'])).toBe(other);
    await expect(edits.wait(['other-order'])).resolves.toBeUndefined();
    deferredSave.resolve();await saving;expect(edits.snapshot(['other-order'])).toBe(other);stop();
  });
  it('updates only the allocation and item, without changing the order status or other order data',()=>{
    const order:Order={id:'o',orderNo:'ORD',status:'SUBMITTED',neededDate:'2026-10-17',kitchen:'Dapur A',estimatedTotal:100,finalTotal:null,items:[{id:'i',name:'Beras',quantity:2,orderUnit:'kg',priceUnit:'kg',unitPrice:50,estimatedWeightKg:null,actualWeightKg:null,prepared:false,allocations:[{id:'a',source:'COOPERATIVE',vendor:null,quantity:1,prepared:false},{id:'b',source:'VENDOR',vendor:'Vendor A',quantity:1,prepared:false}]}]};
    const first=setAllocationPrepared(order,'a',true);
    expect(first.status).toBe('SUBMITTED');expect(first.items[0].prepared).toBe(false);
    const all=setAllocationPrepared(first,'b',true);expect(all.items[0].prepared).toBe(true);
    expect(setAllocationPrepared(all,'a',false).items[0].prepared).toBe(false);
    expect(order.items[0].allocations[0].prepared).toBe(false);
  });
});
