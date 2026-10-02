import {useRef} from 'react';
import {Upload} from 'lucide-react';
import {productImageAccept} from './product-images';
import './photo-upload.css';

type Props={value:string;busy:boolean;disabled?:boolean;centered?:boolean;onSelect:(file:File)=>void;onClear:()=>void};

export function PhotoUpload({value,busy,disabled=false,centered=false,onSelect,onClear}:Props){
  const input=useRef<HTMLInputElement>(null);
  const unavailable=disabled||busy;
  return <div className={centered?'photo-upload photo-upload-centered':'photo-upload'} aria-busy={busy}>
    {value&&<div className="photo-upload-preview"><img src={value} alt="Pratinjau foto produk"/></div>}
    <div className="photo-upload-content">
      <strong>Foto produk</strong>
      <div className="photo-upload-actions">
        <button type="button" className="photo-upload-pick" disabled={unavailable} onClick={()=>input.current?.click()}><Upload size={16} aria-hidden="true"/>{busy?'Memproses…':value?'Ganti foto':'Pilih foto'}</button>
        {value&&<button type="button" className="photo-upload-remove" disabled={unavailable} onClick={onClear}>Hapus foto</button>}
      </div>
      <small role="status">{busy?'Mengubah foto ke WebP…':'PNG, JPG, WebP atau HEIC · maks. 8 MB'}</small>
    </div>
    <input ref={input} type="file" accept={productImageAccept} hidden aria-label="Pilih foto produk" disabled={unavailable} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)onSelect(file)}}/>
  </div>
}
