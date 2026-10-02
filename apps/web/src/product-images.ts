import {api} from './api';

export const productImageAccept='.png,.pn,.jpg,.jpeg,.webp,.heic,.heif,image/png,image/jpeg,image/webp,image/heic,image/heif';
export async function uploadProductImage(file:File){
  if(file.size>8*1024*1024)throw new Error('Ukuran gambar maksimal 8 MB.');
  if(!file.size)throw new Error('File gambar kosong.');
  const result=await api<{image:string}>('/images/convert',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});
  return result.image;
}
