export type User={id:string;name:string;username:string;email:string|null;role:'SUPERADMIN'|'ADMIN'|'BUYER';organizationId:string|null;organization?:string;phone?:string|null;address?:string|null;gmapsUrl?:string|null};
const API='/api';
// Persist across browser restarts; the server enforces token expiry and account validity.
export const session={get token(){return localStorage.getItem('borneo_token')||sessionStorage.getItem('borneo_token')},set(token:string){localStorage.setItem('borneo_token',token);sessionStorage.removeItem('borneo_token')},clear(){sessionStorage.removeItem('borneo_token');localStorage.removeItem('borneo_token')}};
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const headers=new Headers(options.headers);
  if(options.body!=null&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
  if(session.token)headers.set('Authorization',`Bearer ${session.token}`);
  const response=await fetch(`${API}${path}`,{...options,headers});
  if(!response.ok){const body=await response.json().catch(()=>({message:'Permintaan gagal.'}));throw new Error(body.message||'Permintaan gagal.');}
  return response.json();
}
export async function download(path:string,filename:string){
  const response=await fetch(`${API}${path}`,{headers:{Authorization:`Bearer ${session.token}`}});
  if(!response.ok)throw new Error('Ekspor gagal.');
  const blob=await response.blob();
  // Android's native save dialog accepts data URLs, without exposing a JavaScript bridge.
  const android=/\bBorneoAndroid\//.test(navigator.userAgent);
  if(android&&blob.size>20*1024*1024)throw new Error('Dokumen terlalu besar untuk disimpan di aplikasi (maksimal 20 MB).');
  const url=android?await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);
    reader.onerror=()=>reject(new Error('Dokumen tidak dapat dibaca.'));reader.readAsDataURL(blob);
  }):URL.createObjectURL(blob);
  const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;
  document.body.append(anchor);anchor.click();anchor.remove();
  if(!android)setTimeout(()=>URL.revokeObjectURL(url),30000);
}
