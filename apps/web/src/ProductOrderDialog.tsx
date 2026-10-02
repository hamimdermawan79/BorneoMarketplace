import {useEffect,useRef,type KeyboardEvent} from 'react';
import {Minus,Plus,ShoppingCart,X} from 'lucide-react';
import {ProductImage} from './ProductImage';
import {validOrderQuantity} from './order-input';

type Product = {
  name: string; image: string|null; orderUnit: string; priceUnit: string;
  salePrice: number; availableStock: number; weighingRequired: boolean; estimatedKgPerUnit: number|null;
};
const money=(value:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);

export function adjustProductQuantity(value:string,delta:-1|1,wholeUnits:boolean):string {
  if(!validOrderQuantity(value,wholeUnits))return '1';
  const minimum=wholeUnits?1:0.001;
  return String(Math.min(1_000_000,Math.max(minimum,Math.round((Number(value)+delta)*1000)/1000)));
}

export function ProductOrderDialog({product,quantity,onQuantityChange,onAdd,onClose}:{
  product:Product; quantity:string; onQuantityChange:(value:string)=>void;
  onAdd:()=>void; onClose:()=>void;
}) {
  const dialogRef=useRef<HTMLElement>(null);
  const quantityRef=useRef<HTMLInputElement>(null);
  const closeRef=useRef(onClose);
  closeRef.current=onClose;
  const valid=validOrderQuantity(quantity,product.weighingRequired);
  const total=valid?Number(quantity)*Number(product.salePrice)*(product.weighingRequired?Number(product.estimatedKgPerUnit):1):null;
  useEffect(()=>{
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    quantityRef.current?.focus();
    quantityRef.current?.select();
    const escape=(event:globalThis.KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();closeRef.current();}
    };
    document.addEventListener('keydown',escape);
    return()=>{
      document.removeEventListener('keydown',escape);
      document.body.style.overflow=previousOverflow;
      if(previousFocus?.isConnected)previousFocus.focus();
    };
  },[]);
  const trapFocus=(event:KeyboardEvent<HTMLElement>)=>{
    if(event.key!=='Tab')return;
    const controls=dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)');
    if(!controls?.length)return;
    const first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  return <div className="modal-backdrop product-order-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section ref={dialogRef} className="modal-card product-order-dialog" role="dialog" aria-modal="true" aria-label={`Pesan produk ${product.name}`} onKeyDown={trapFocus}>
      <header>
        <ProductImage src={product.image||'/assets/logo/logo.webp'} alt={product.name}/>
        <div><h2>{product.name}</h2><p>{money(Number(product.salePrice))} / {product.priceUnit}</p><p className="product-order-stock" id="product-order-stock">Tersedia {Number(product.availableStock).toLocaleString('id-ID')} {product.priceUnit}</p></div>
        <button type="button" className="product-order-close" aria-label="Tutup pesanan produk" onClick={onClose}><X size={18}/></button>
      </header>
      <form onSubmit={event=>{event.preventDefault();if(valid)onAdd();}}>
        <div className="product-order-quantity">
          <label htmlFor="product-order-quantity-input">Jumlah <span>({product.orderUnit})</span></label>
          <div className="product-quantity-controls">
            <button type="button" aria-label="Kurangi jumlah" disabled={valid&&Number(quantity)<=(product.weighingRequired?1:0.001)} onClick={()=>onQuantityChange(adjustProductQuantity(quantity,-1,product.weighingRequired))}><Minus size={14}/></button>
            <input ref={quantityRef} id="product-order-quantity-input" type="number" inputMode={product.weighingRequired?'numeric':'decimal'} min={product.weighingRequired?'1':'0.001'} max="1000000" step={product.weighingRequired?'1':'0.001'} required value={quantity} aria-invalid={!valid} aria-describedby="product-order-stock" onChange={event=>onQuantityChange(event.target.value)}/>
            <button type="button" aria-label="Tambah jumlah" disabled={valid&&Number(quantity)>=1_000_000} onClick={()=>onQuantityChange(adjustProductQuantity(quantity,1,product.weighingRequired))}><Plus size={14}/></button>
          </div>
        </div>
        {!valid&&<p className="product-quantity-error" role="status">{product.weighingRequired?'Masukkan jumlah bulat minimal 1.':'Masukkan jumlah positif, maksimal 3 angka desimal.'}</p>}
        {product.weighingRequired&&<p className="product-order-note">Estimasi {Number(product.estimatedKgPerUnit).toLocaleString('id-ID')} kg/{product.orderUnit}. Harga akhir mengikuti berat aktual.</p>}
        <div className="product-order-total"><span>{product.weighingRequired?'Estimasi total':'Subtotal'}</span><strong>{total!==null?money(total):'—'}</strong></div>
        <button className="primary product-order-submit" disabled={!valid}><ShoppingCart size={17}/>Tambah ke keranjang</button>
      </form>
    </section>
  </div>;
}
