import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,stat,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {apiDirectory,maintenanceUrl,maintenancePool} from './maintenance.js';
import '../config.js';
import {backupPrivateProductImages} from '../images/backup.js';

const url=new URL(maintenanceUrl());
const directory=join(apiDirectory,'backups');
await mkdir(directory,{recursive:true,mode:0o700});
const file=join(directory,`backup-${Date.now()}-${randomUUID()}.dump`);
try{
  await promisify(execFile)(process.env.PG_DUMP_PATH||'pg_dump',['--format=custom','--file',file],{
    timeout:120000,windowsHide:true,env:{...process.env,
      PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:decodeURIComponent(url.pathname.slice(1)),
      PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),
      ...(url.searchParams.get('sslmode')?{PGSSLMODE:url.searchParams.get('sslmode')!}:{})}
  });
  if((await stat(file)).size===0)throw new Error('Empty backup');
  await chmod(file,0o600);
  const db=maintenancePool();
  try{
    const images=(await db.query("SELECT image_path FROM product_templates WHERE image_path LIKE '/api/product-images/%'")).rows;
    const count=await backupPrivateProductImages(images.map(row=>row.image_path),`${file}.media`);
    console.log(`Backup created: ${file}; ${count} private images copied to its .media directory.`);
  }finally{await db.end();}
}catch{
  throw new Error('Backup failed. Check PostgreSQL tooling and credentials; no data was changed.');
}
