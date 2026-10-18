import {api} from './api';

export async function cropSquareImage(source:string,positionX=50,positionY=50,zoom=1){
  const image=new Image();
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Gambar tidak dapat dibaca.'));image.src=source;});
  const size=640,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
  const context=canvas.getContext('2d');if(!context)throw new Error('Editor gambar tidak tersedia.');
  const scale=Math.max(size/image.naturalWidth,size/image.naturalHeight)*zoom;
  const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
  context.drawImage(image,-Math.max(0,width-size)*(positionX/100),-Math.max(0,height-size)*(positionY/100),width,height);
  return canvas.toDataURL('image/webp',.82);
}

export const productImageAccept='.png,.pn,.jpg,.jpeg,.webp,.heic,.heif,image/png,image/jpeg,image/webp,image/heic,image/heif';
export async function uploadProductImage(file:File){
  if(file.size>8*1024*1024)throw new Error('Ukuran gambar maksimal 8 MB.');
  if(!file.size)throw new Error('File gambar kosong.');
  const result=await api<{image:string}>('/images/convert',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});
  return result.image;
}
