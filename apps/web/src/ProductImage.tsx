import {useEffect,useState,type ImgHTMLAttributes} from 'react';
import {session} from './api';

const fallback='/assets/logo/logo.webp';
export function ProductImage({src,alt,...props}:ImgHTMLAttributes<HTMLImageElement>){
  const [loaded,setLoaded]=useState<{source:string;url:string}|null>(null);
  const privateImage=Boolean(src?.startsWith('/api/product-images/'));
  useEffect(()=>{
    if(!src?.startsWith('/api/product-images/'))return;
    const controller=new AbortController();let objectUrl='';let active=true;
    fetch(src,{headers:{Authorization:`Bearer ${session.token||''}`},signal:controller.signal,cache:'no-store'})
      .then(response=>{if(!response.ok||response.headers.get('content-type')?.split(';')[0]!=='image/webp')throw new Error('Image unavailable');return response.blob();})
      .then(blob=>{if(!active)return;objectUrl=URL.createObjectURL(blob);setLoaded({source:src,url:objectUrl});})
      .catch(()=>{});
    return()=>{active=false;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[src]);
  const resolved=privateImage?(loaded&&loaded.source===src?loaded.url:fallback):(src||fallback);
  return <img {...props} src={resolved} alt={alt||''} onError={event=>{if(event.currentTarget.src!==new URL(fallback,window.location.origin).href)event.currentTarget.src=fallback;props.onError?.(event);}}/>;
}
