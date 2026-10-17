import {useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {api} from './api';
import {preparationTotal,requiresActualWeight,validOrderQuantity} from './order-input';
import {OrderEdits,setAllocationPrepared,type Allocation,type ChangeOrder,type Order,type OrderItem} from './admin-order-updates';
import './order-feedback.css';

const currency=new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0});
const quantityFormat=new Intl.NumberFormat('id-ID');
const statusLabel:Record<string,string>={SUBMITTED:'Pesanan masuk',PREPARING:'Sedang disiapkan',SHIPPED:'Dikirim',AWAITING_KITCHEN:'Menunggu dapur',COMPLETED:'Selesai',CANCELLED:'Dibatalkan'};
type Props={order:Order;admin?:boolean;buyerAction?:()=>void;reload?:()=>Promise<unknown>;embedded?:boolean;groupedOrders?:Order[];edits?:OrderEdits;onOrderChange?:ChangeOrder;onStockChanged?:()=>void};

export function OrderCard({order,admin,buyerAction,reload,embedded,groupedOrders,edits:sharedEdits,onOrderChange,onStockChanged}:Props) {
  const [ownEdits]=useState(()=>new OrderEdits());
  const edits=sharedEdits||ownEdits;
  const targets=groupedOrders||[order];
  const ids=targets.map(target=>target.id);
  useSyncExternalStore(edits.subscribe,()=>edits.snapshot(ids),()=> '');
  const [weightDrafts,setWeightDrafts]=useState<Record<string,string>>({});
  const [statusAction,setStatusAction]=useState('');
  const [refreshWarning,setRefreshWarning]=useState('');
  const busy=edits.busy(ids);
  const actionError=edits.error(ids);
  const feedback=edits.feedback(ids);
  const dirtyWeight=order.items.some(item=>requiresActualWeight(item)&&weightDrafts[item.id]!==undefined&&(!validOrderQuantity(weightDrafts[item.id],false)||Number(weightDrafts[item.id])!==Number(item.actualWeightKg)));
  const saveFeedback=feedback==='Menyimpan…'||actionError?feedback:dirtyWeight?'Belum tersimpan':feedback;
  const {bySource,itemOrders,firstAllocations}=useMemo(()=>{
    const bySource:{COOPERATIVE:{item:OrderItem;allocation:Allocation}[];VENDOR:{item:OrderItem;allocation:Allocation}[]}={COOPERATIVE:[],VENDOR:[]};
    const itemOrders=new Map<string,Order>();
    const firstAllocations=new Map<string,string>();
    for(const target of targets)for(const item of target.items)itemOrders.set(item.id,target);
    for(const item of order.items)for(const allocation of item.allocations)bySource[allocation.source].push({item,allocation});
    for(const {item,allocation} of [...bySource.COOPERATIVE,...bySource.VENDOR])if(!firstAllocations.has(item.id))firstAllocations.set(item.id,allocation.id);
    return {bySource,itemOrders,firstAllocations};
  },[order.items,groupedOrders,order]);
  useEffect(()=>{
    if(sharedEdits)return;
    const warn=(event:BeforeUnloadEvent)=>{if(edits.hasPending()){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[edits,sharedEdits]);
  const updateAllocation=(item:OrderItem,allocation:Allocation,prepared:boolean)=>{
    const target=itemOrders.get(item.id)||order;
    void edits.save(`allocation:${allocation.id}`,target.id,prepared,async()=>{
      await api(`/allocations/${allocation.id}/prepared`,{method:'PATCH',body:JSON.stringify({prepared})});
      if(onOrderChange)onOrderChange(target.id,current=>setAllocationPrepared(current,allocation.id,prepared));
      else await reload?.();
    });
  };
  const weight=(item:OrderItem,value:string)=>{
    const target=itemOrders.get(item.id)||order;
    const key=`weight:${item.id}`;
    if(!validOrderQuantity(value,false)){edits.invalid(key,target.id,'Isi berat aktual lebih dari 0 kg, maksimal 3 angka desimal.');return;}
    if(item.actualWeightKg!=null&&Number(value)===Number(item.actualWeightKg)){edits.clearError(key,target.id);return;}
    void edits.save(key,target.id,value,async()=>{
      await api(`/order-items/${item.id}/actual-weight`,{method:'PATCH',body:JSON.stringify({actualWeightKg:Number(value)})});
      if(onOrderChange)onOrderChange(target.id,current=>({...current,items:current.items.map(row=>row.id===item.id?{...row,actualWeightKg:Number(value)}:row)}));
      else await reload?.();
    });
  };
  const status=async(next:string)=>{
    if(!edits.beginStatus(ids))return;
    setStatusAction(next);setRefreshWarning('');
    let failure:unknown;
    let stockChanged=false;
    try{
      await edits.wait(ids);
      const previous:Record<string,string>={PREPARING:'SUBMITTED',SHIPPED:'PREPARING',AWAITING_KITCHEN:'SHIPPED'};
      for(const target of targets.filter(entry=>entry.status===(previous[next]||entry.status))){
        const result=await api<{status:string;finalTotal:number|null}>(`/orders/${target.id}/status`,{method:'PATCH',body:JSON.stringify({status:next})});
        // Confirmed server changes remain applied even if a later grouped order fails.
        if(onOrderChange)onOrderChange(target.id,current=>({...current,status:result.status,finalTotal:result.finalTotal??current.finalTotal}));
        if(next==='SHIPPED'){
          stockChanged=true;
          if(onOrderChange){
            try{const fresh=await api<Order>(`/orders/${target.id}`);onOrderChange(target.id,()=>fresh);}
            catch{setRefreshWarning('Status pengiriman sudah tersimpan. Detail terbaru belum berhasil dimuat; muat ulang jika diperlukan.');}
          }
        }
      }
      if(!onOrderChange)await reload?.();
    }catch(error){failure=error;}
    finally{edits.endStatus(ids,failure);setStatusAction('');if(stockChanged)onStockChanged?.();}
  };
  const buttonText:Record<string,string>={PREPARING:'Memulai persiapan…',SHIPPED:'Mengirim pesanan…',AWAITING_KITCHEN:'Menyelesaikan pengiriman…'};
  return <article className={`order-card${embedded?' embedded':''}`}>
    {actionError&&<div className="notice" role="alert">{actionError}</div>}
    {refreshWarning&&<div className="notice" role="status">{refreshWarning}</div>}
    {!embedded&&<div className="order-heading"><div><small>{order.orderNo}</small><h2>{order.kitchen}</h2><span>Dibutuhkan {new Date(order.neededDate).toLocaleDateString('id-ID')}</span></div><span className="status">{statusLabel[order.status]}</span></div>}
    {admin?(['COOPERATIVE','VENDOR'] as const).map(source=>bySource[source].length>0&&<section className="source-group" key={source}>
      <h3>{source==='COOPERATIVE'?'Dari Koperasi':'Dari Vendor'}</h3>
      {bySource[source].map(({item,allocation})=>{
        const target=itemOrders.get(item.id)||order;
        const checkKey=`allocation:${allocation.id}`;
        const weightKey=`weight:${item.id}`;
        const saving=edits.saving(checkKey);
        const checked=edits.value(checkKey);
        return <div className="check-row" key={allocation.id}>
          <label><input type="checkbox" checked={typeof checked==='boolean'?checked:allocation.prepared} disabled={busy||saving||!['SUBMITTED','PREPARING'].includes(target.status)} aria-busy={saving} aria-label={`Siapkan ${item.name}${source==='VENDOR'?` dari ${allocation.vendor||'Vendor'}`:' dari koperasi'}`} onChange={event=>updateAllocation(item,allocation,event.target.checked)}/>
            <span className="preparation-item"><strong>{item.name}</strong><b>{quantityFormat.format(Number(requiresActualWeight(item)?item.quantity:allocation.quantity))} {requiresActualWeight(item)?item.orderUnit:item.priceUnit}</b>{requiresActualWeight(item)&&<small className="item-estimate">est. {quantityFormat.format(Number(allocation.quantity))} kg</small>}{source==='VENDOR'&&<small>{allocation.vendor||'Vendor'}</small>}</span>
          </label>
          {requiresActualWeight(item)&&firstAllocations.get(item.id)===allocation.id&&<label className="item-weight"><span>Berat aktual</span><input aria-label={`Berat aktual ${item.name} dalam kg`} type="number" step="0.001" min="0.001" value={weightDrafts[item.id]??String(edits.value(weightKey)??item.actualWeightKg??'')} onChange={event=>setWeightDrafts(current=>({...current,[item.id]:event.target.value}))} disabled={busy||edits.saving(weightKey)||target.status!=='PREPARING'} aria-busy={edits.saving(weightKey)} onBlur={event=>weight(item,event.target.value)}/><span>kg</span></label>}
        </div>;
      })}
    </section>):<section className="source-group"><h3>Barang dipesan</h3>{order.items.map(item=><div className="check-row" key={item.id}><span><strong>{item.name}</strong><small>{item.quantity} {item.orderUnit}{item.actualWeightKg?` · ${item.actualWeightKg} kg aktual`:''}</small></span></div>)}</section>}
    <footer><div className="order-price-summary"><strong>{currency.format(order.finalTotal!=null?Number(order.finalTotal):preparationTotal(order.items,weightDrafts))}</strong>{admin&&<small className="order-save-feedback" role="status" aria-live="polite">{saveFeedback}</small>}</div><div className="order-status-actions">
      {admin&&order.status==='SUBMITTED'&&<button disabled={busy} aria-busy={busy} onClick={()=>void status('PREPARING')}>{busy?buttonText[statusAction]||'Menyimpan…':'Mulai siapkan'}</button>}
      {admin&&order.status==='PREPARING'&&<button className="primary" disabled={busy} aria-busy={busy} onClick={()=>void status('SHIPPED')}>{busy?buttonText[statusAction]||'Menyimpan…':'Kirim pesanan'}</button>}
      {admin&&order.status==='SHIPPED'&&<button className="primary" disabled={busy} aria-busy={busy} onClick={()=>void status('AWAITING_KITCHEN')}>{busy?buttonText[statusAction]||'Menyimpan…':'Selesaikan pengiriman'}</button>}
      {buyerAction&&<button className="primary" onClick={buyerAction}>Konfirmasi diterima</button>}
    </div></footer>
  </article>;
}
