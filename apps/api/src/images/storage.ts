import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,realpath,lstat} from 'node:fs/promises';
import {isAbsolute,relative,resolve,sep,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {convertToWebp} from './convert.js';

export type ProductImageKind='produk-pokok'|'produk-tambahan';
const publicRoot=fileURLToPath(new URL('../../../web/',import.meta.url));
const defaultRoot=fileURLToPath(new URL('../../../../storage/private/produk/',import.meta.url));
export const privateImagePattern=/^\/api\/product-images\/(produk-pokok|produk-tambahan)\/([a-f0-9-]{36})\.webp$/;
const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const inside=(parent:string,child:string)=>{const path=relative(parent,child);return !path||(!isAbsolute(path)&&path!=='..'&&!path.startsWith('..'+sep));};

export function productStorageDirectory(){
  const override=process.env.PRODUCT_STORAGE_DIR;
  if(override&&!isAbsolute(override))throw new Error('PRODUCT_STORAGE_DIR must be an absolute private directory.');
  const root=resolve(override||defaultRoot);
  if(inside(publicRoot,root))throw new Error('Product storage must be outside the web application.');
  return root;
}
async function directory(kind:ProductImageKind){
  const root=productStorageDirectory();
  await mkdir(root,{recursive:true,mode:0o700});
  const canonicalRoot=await realpath(root);
  if(inside(await realpath(publicRoot),canonicalRoot))throw new Error('Product storage cannot resolve to a public directory.');
  const target=join(root,kind);
  await mkdir(target,{recursive:true,mode:0o700});
  if((await lstat(target)).isSymbolicLink()||!inside(canonicalRoot,await realpath(target)))throw new Error('Unsafe product storage directory.');
  return target;
}
export async function storeProductImage(input:Buffer,kind:ProductImageKind){
  const output=await convertToWebp(input);
  const filename=`${randomUUID()}.webp`;
  await writeFile(join(await directory(kind),filename),output,{flag:'wx',mode:0o600});
  return `/api/product-images/${kind}/${filename}`;
}
export async function persistProductImage(value:string|null|undefined,kind:ProductImageKind){
  if(!value)return null;
  // Product writes accept actual image data, never a caller-supplied file path.
  if(!value.startsWith('data:'))throw Object.assign(new Error('Unggah foto produk melalui formulir.'),{statusCode:400});
  return storeProductImage(Buffer.from(value.slice(value.indexOf(',')+1),'base64'),kind);
}
export async function readProductImage(kind:ProductImageKind,filename:string){
  if(!uuidPattern.test(filename.replace(/\.webp$/,''))||!filename.endsWith('.webp'))throw Object.assign(new Error('Gambar tidak ditemukan.'),{statusCode:404});
  const path=join(await directory(kind),filename);
  try{
    const info=await lstat(path);
    if(!info.isFile()||info.isSymbolicLink())throw new Error('Not a regular image');
    return await readFile(path);
  }catch{throw Object.assign(new Error('Gambar tidak ditemukan.'),{statusCode:404});}
}
