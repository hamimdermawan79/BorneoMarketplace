import {useEffect,useRef} from 'react';

export function DeleteAccountDialog({name,busy,error,cancel,confirm}:{name:string;busy:boolean;error:string;cancel:()=>void;confirm:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{previous?.focus()}},[]);
  return <dialog ref={dialog} className="modal-card product-delete-dialog" aria-labelledby="delete-account-title" aria-describedby="delete-account-description" onCancel={event=>{event.preventDefault();if(!busy)cancel()}}>
    <header><h2 id="delete-account-title">Hapus Akun?</h2></header>
    <div><p id="delete-account-description">Akun <strong>{name}</strong> akan dihapus dari daftar dan tidak dapat diaktifkan kembali. Histori transaksi tetap disimpan.</p>
      {error&&<p className="notice" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" autoFocus disabled={busy} onClick={cancel}>Batal</button><button type="button" className="product-delete-confirm" disabled={busy} onClick={confirm}>{busy?'Menghapus…':'Hapus Akun'}</button></div>
    </div>
  </dialog>;
}
