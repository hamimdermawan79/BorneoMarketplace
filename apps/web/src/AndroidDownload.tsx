import {useState} from 'react';
import {Download} from 'lucide-react';

export function AndroidDownload(){
  const[checking,setChecking]=useState(false),[message,setMessage]=useState('');
  const download=async()=>{
    if(checking)return;
    setChecking(true);setMessage('');
    try{
      const path='/downloads/borneo-marketplace.apk';
      const response=await fetch(path,{method:'HEAD',cache:'no-store'});
      const type=response.headers.get('content-type')||'';
      if(!response.ok||!['application/vnd.android.package-archive','application/octet-stream'].some(value=>type.startsWith(value)))return;
      const link=document.createElement('a');link.href=path;link.download='borneo-marketplace.apk';document.body.append(link);link.click();link.remove();
    }catch(error){setMessage(error instanceof TypeError?'Tidak dapat menghubungi server. Coba lagi.':(error as Error).message)}finally{setChecking(false)}
  };
  return <><button className="landing-button secondary android-download-button" type="button" onClick={()=>void download()} disabled={checking}><Download size={16} aria-hidden="true"/>{checking?'Memeriksa…':'Download APK'}</button>{message&&<p className="download-feedback" role="status">{message}</p>}</>;
}
