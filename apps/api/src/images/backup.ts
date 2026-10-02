import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {privateImagePattern,readProductImage,type ProductImageKind} from './storage.js';

export async function backupPrivateProductImages(paths:string[],destination:string){
  let copied=0;
  for(const path of new Set(paths)){
    const match=privateImagePattern.exec(path);
    if(!match)continue; // Embedded legacy images are already part of the database dump.
    const kind=match[1] as ProductImageKind,filename=`${match[2]}.webp`;
    const data=await readProductImage(kind,filename);
    const directory=join(destination,'produk',kind);
    await mkdir(directory,{recursive:true,mode:0o700});
    await writeFile(join(directory,filename),data,{flag:'wx',mode:0o600});copied++;
  }
  return copied;
}
