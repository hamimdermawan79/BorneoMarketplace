import {afterEach,beforeEach,describe,it,expect} from 'vitest';
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {storeProductImage,persistProductImage,readProductImage,productStorageDirectory} from './storage.js';
import {backupPrivateProductImages} from './backup.js';

let directory:string,previous:string|undefined;
beforeEach(async()=>{previous=process.env.PRODUCT_STORAGE_DIR;directory=await mkdtemp(join(tmpdir(),'borneo-private-image-unit-'));process.env.PRODUCT_STORAGE_DIR=directory;});
afterEach(async()=>{
  if(previous===undefined)delete process.env.PRODUCT_STORAGE_DIR;else process.env.PRODUCT_STORAGE_DIR=previous;
  if(!directory.startsWith(join(tmpdir(),'borneo-private-image-unit-')))throw new Error('Unsafe test cleanup target');
  await rm(directory,{recursive:true});
});
describe('private product storage',()=>{
  it('persists data URLs as private file references rather than embedded database images',async()=>{
    const input=await sharp({create:{width:3,height:3,channels:3,background:'#aaddff'}}).png().toBuffer();
    const path=await persistProductImage(`data:image/png;base64,${input.toString('base64')}`,'produk-tambahan');
    expect(path).toMatch(/^\/api\/product-images\/produk-tambahan\//);
    expect((await sharp(await readProductImage('produk-tambahan',path!.split('/').at(-1)!)).metadata()).format).toBe('webp');
  });
  it('separates product kinds, assigns opaque filenames and stores only canonical WebP',async()=>{
    const input=await sharp({create:{width:8,height:8,channels:4,background:{r:100,g:170,b:200,alpha:.5}}}).png().toBuffer();
    for(const kind of ['produk-pokok','produk-tambahan'] as const){
      const path=await storeProductImage(input,kind);
      expect(path).toMatch(new RegExp(`^/api/product-images/${kind}/[a-f0-9-]{36}\\.webp$`));
      const filename=path.split('/').at(-1)!;
      const output=await readProductImage(kind,filename);
      expect(output).toEqual(await readFile(join(directory,kind,filename)));
      expect((await sharp(output).metadata()).format).toBe('webp');
      expect(await readdir(join(directory,kind))).toEqual([filename]);
    }
  });
  it('rejects caller-supplied paths and traversal without storing them',async()=>{
    expect(await persistProductImage(null,'produk-pokok')).toBeNull();
    for(const path of ['/assets/produk/test.webp','/api/product-images/produk-pokok/test.webp','../private.webp'])await expect(persistProductImage(path,'produk-pokok')).rejects.toMatchObject({statusCode:400});
    await expect(readProductImage('produk-pokok','../../secret.webp')).rejects.toMatchObject({statusCode:404});
    expect(await readdir(directory)).toEqual([]);
  });
  it('refuses relative or public storage configuration',()=>{
    process.env.PRODUCT_STORAGE_DIR='public/assets';expect(()=>productStorageDirectory()).toThrow();
    process.env.PRODUCT_STORAGE_DIR=fileURLToPath(new URL('../../../web/public/assets/produk/',import.meta.url));
    expect(()=>productStorageDirectory()).toThrow();
  });
  it('backs up private referenced files and fails if a required file is missing',async()=>{
    const input=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer();
    const path=await storeProductImage(input,'produk-pokok');
    const destination=join(directory,'backup');
    expect(await backupPrivateProductImages([path,path,'data:image/webp;base64,legacy'],destination)).toBe(1);
    expect((await sharp(await readFile(join(destination,'produk','produk-pokok',path.split('/').at(-1)!))).metadata()).format).toBe('webp');
    await expect(backupPrivateProductImages(['/api/product-images/produk-pokok/00000000-0000-4000-8000-000000000000.webp'],join(directory,'missing'))).rejects.toMatchObject({statusCode:404});
  });
});
