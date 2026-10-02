import {readFile,realpath,mkdir,copyFile} from 'node:fs/promises';
import {join,relative,isAbsolute,sep} from 'node:path';
import {apiDirectory,maintenancePool} from './maintenance.js';
import '../config.js';
import {storeProductImage,privateImagePattern} from '../images/storage.js';

// Run db:backup first. This CLI does not remove any source image or overwrite files.
const db=maintenancePool();
const publicRoot=await realpath(join(apiDirectory,'../web/public'));
const backupDirectory=join(apiDirectory,'backups',`images-${Date.now()}`);
try{
  const rows=(await db.query('SELECT id,image_path,owner_admin_user_id FROM product_templates WHERE image_path IS NOT NULL')).rows;
  let migrated=0;
  for(const row of rows){
    if(privateImagePattern.test(row.image_path))continue;
    let input:Buffer;
    if(row.image_path.startsWith('data:image/'))input=Buffer.from(row.image_path.slice(row.image_path.indexOf(',')+1),'base64');
    else{
      if(!/^\/assets\/produk\//.test(row.image_path))throw new Error(`Unexpected product image reference for ${row.id}; left unchanged.`);
      const source=await realpath(join(publicRoot,row.image_path.slice(1)));
      const path=relative(publicRoot,source);
      if(isAbsolute(path)||path==='..'||path.startsWith('..'+sep))throw new Error('Unsafe legacy image path');
      input=await readFile(source);
      await mkdir(backupDirectory,{recursive:true,mode:0o700});
      await copyFile(source,join(backupDirectory,`${row.id}-original`));
    }
    const image=await storeProductImage(input,row.owner_admin_user_id?'produk-tambahan':'produk-pokok');
    const update=await db.query('UPDATE product_templates SET image_path=$1 WHERE id=$2 AND image_path=$3',[image,row.id,row.image_path]);
    if(update.rowCount)migrated++;
  }
  console.log(`Migrated ${migrated} product images into private storage. No source files were deleted.`);
}finally{await db.end();}
