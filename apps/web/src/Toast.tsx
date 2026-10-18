import {useEffect,useState} from 'react';
import {Bell,X} from 'lucide-react';
import './toast.css';

export function Toast({message,onDismiss}:{message:string;onDismiss:()=>void}){
  const [paused,setPaused]=useState(false);
  useEffect(()=>{
    if(!message||paused)return;
    const timer=window.setTimeout(onDismiss,7000);
    return()=>window.clearTimeout(timer);
  },[message,onDismiss,paused]);
  if(!message)return null;
  return <aside className="app-toast" aria-label="Notifikasi" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false)}}>
    <span className="app-toast-icon" aria-hidden="true"><Bell size={19}/></span>
    <div className="app-toast-content" role="status" aria-live="polite" aria-atomic="true"><strong>Notifikasi</strong><p>{message}</p></div>
    <button type="button" className="app-toast-close" aria-label="Tutup notifikasi" onClick={onDismiss}><X size={17}/></button>
  </aside>;
}
