import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './pdf-orientation.css';

export function PdfOrientationDialog({onConfirm,onClose}:{onConfirm:(orientation:'portrait'|'landscape')=>void;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  const [orientation,setOrientation]=useState<'portrait'|'landscape'>('landscape');
  useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>dialog.close()},[]);
  return createPortal(<dialog ref={ref} className="pdf-orientation-dialog" aria-labelledby="pdf-orientation-title" onCancel={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose()}}>
    <form onSubmit={event=>{event.preventDefault();onConfirm(orientation)}}>
      <h2 id="pdf-orientation-title">Orientasi PDF</h2>
      <p>Pilih tata letak kertas A4.</p>
      <fieldset aria-label="Orientasi Halaman">
        <label><input type="radio" name="orientation" value="landscape" checked={orientation==='landscape'} onChange={()=>setOrientation('landscape')}/> Landscape <small>Mendatar</small></label>
        <label><input type="radio" name="orientation" value="portrait" checked={orientation==='portrait'} onChange={()=>setOrientation('portrait')}/> Portrait <small>Tegak</small></label>
      </fieldset>
      <footer><button type="button" onClick={onClose}>Batal</button><button className="primary" type="submit">Unduh PDF</button></footer>
    </form>
  </dialog>,document.body);
}
