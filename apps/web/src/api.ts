export type User={id:string;name:string;email:string;role:'SUPERADMIN'|'ADMIN'|'BUYER';organizationId:string|null;organization?:string;phone?:string|null;address?:string|null;gmapsUrl?:string|null};
const API='/api';
// Keep bearer credentials only for this tab session, never indefinitely on disk.
localStorage.removeItem('borneo_token');
export const session={get token(){return sessionStorage.getItem('borneo_token')},set(token:string){sessionStorage.setItem('borneo_token',token)},clear(){sessionStorage.removeItem('borneo_token');localStorage.removeItem('borneo_token')}};
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const response=await fetch(`${API}${path}`,{...options,headers:{'Content-Type':'application/json',...(session.token?{Authorization:`Bearer ${session.token}`} : {}),...options.headers}});
  if(!response.ok){const body=await response.json().catch(()=>({message:'Permintaan gagal.'}));throw new Error(body.message||'Permintaan gagal.');}
  return response.json();
}
export async function download(path:string,filename:string){const response=await fetch(`${API}${path}`,{headers:{Authorization:`Bearer ${session.token}`}});if(!response.ok)throw new Error('Ekspor gagal.');const blob=await response.blob();const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();URL.revokeObjectURL(url);}
