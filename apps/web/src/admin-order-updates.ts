export type Allocation = {id:string;source:'COOPERATIVE'|'VENDOR';vendor:string|null;quantity:number;prepared:boolean};
export type OrderItem = {id:string;name:string;quantity:number;orderUnit:string;priceUnit:string;unitPrice:number;estimatedWeightKg:number|null;actualWeightKg:number|null;prepared:boolean;allocations:Allocation[]};
export type Order = {id:string;orderNo:string;status:string;neededDate:string;kitchen:string;estimatedTotal:number;finalTotal:number|null;items:OrderItem[]};
export type ChangeOrder = (id:string, update:(order:Order)=>Order)=>void;

type Save = {orderId:string;value:boolean|string;promise:Promise<boolean>};
const message = (error:unknown) => error instanceof Error ? error.message : 'Perubahan gagal disimpan. Coba lagi.';

// Owned by Admin, not the card: navigating between menus cannot bypass pending saves.
export class OrderEdits {
  private listeners = new Set<()=>void>();
  private revisions = new Map<string,number>();
  private pending = new Map<string,Save>();
  private failures = new Map<string,{orderId:string;message:string}>();
  private saved = new Set<string>();
  private changingStatus = new Set<string>();
  private statusErrors = new Map<string,string>();
  subscribe = (listener:()=>void) => {this.listeners.add(listener);return()=>{this.listeners.delete(listener)};};
  snapshot = (ids:string[]) => ids.map(id=>this.revisions.get(id)||0).join('|');
  private notify(ids:string[]) {
    for(const id of ids)this.revisions.set(id,(this.revisions.get(id)||0)+1);
    for(const listener of this.listeners)listener();
  }
  value(key:string) {return this.pending.get(key)?.value;}
  saving(key:string) {return this.pending.has(key);}
  busy(ids:string[]) {return ids.some(id=>this.changingStatus.has(id));}
  hasPending() {return this.pending.size>0||this.changingStatus.size>0;}
  error(ids:string[]) {
    return [...this.failures.values()].find(entry=>ids.includes(entry.orderId))?.message
      || ids.map(id=>this.statusErrors.get(id)).find(Boolean) || '';
  }
  feedback(ids:string[]) {
    if([...this.pending.values()].some(entry=>ids.includes(entry.orderId)))return 'Menyimpan…';
    if([...this.failures.values()].some(entry=>ids.includes(entry.orderId)))return 'Gagal disimpan. Coba lagi.';
    return ids.some(id=>this.saved.has(id))?'Tersimpan':'';
  }
  save(key:string, orderId:string, value:boolean|string, work:()=>Promise<void>):Promise<boolean> {
    const existing=this.pending.get(key);
    if(existing)return existing.promise;
    if(this.changingStatus.has(orderId))return Promise.resolve(false);
    this.failures.delete(key);
    // Start after registration so even a synchronous failure is tracked correctly.
    const promise=Promise.resolve().then(work).then(()=>{
      this.saved.add(orderId);return true;
    },error=>{
      this.failures.set(key,{orderId,message:message(error)});return false;
    }).finally(()=>{this.pending.delete(key);this.notify([orderId]);});
    this.pending.set(key,{orderId,value,promise});this.notify([orderId]);
    return promise;
  }
  invalid(key:string,orderId:string,error:string) {
    this.failures.set(key,{orderId,message:error});this.notify([orderId]);
  }
  clearError(key:string,orderId:string) {this.failures.delete(key);this.notify([orderId]);}
  beginStatus(ids:string[]) {
    if(this.busy(ids))return false;
    for(const id of ids){this.changingStatus.add(id);this.statusErrors.delete(id);}
    this.notify(ids);return true;
  }
  async wait(ids:string[]) {
    const tasks=[...this.pending.values()].filter(entry=>ids.includes(entry.orderId));
    await Promise.all(tasks.map(entry=>entry.promise));
    if([...this.failures.values()].some(entry=>ids.includes(entry.orderId)))throw new Error('Ada checklist atau berat aktual yang belum tersimpan. Perbaiki atau coba simpan lagi sebelum melanjutkan.');
  }
  endStatus(ids:string[],error?:unknown) {
    for(const id of ids){this.changingStatus.delete(id);if(error)this.statusErrors.set(id,message(error));}
    this.notify(ids);
  }
}

export function setAllocationPrepared(order:Order,id:string,prepared:boolean):Order {
  return {...order,items:order.items.map(item=>{
    if(!item.allocations.some(allocation=>allocation.id===id))return item;
    const allocations=item.allocations.map(allocation=>allocation.id===id?{...allocation,prepared}:allocation);
    return {...item,allocations,prepared:allocations.every(allocation=>allocation.prepared)};
  })};
}
