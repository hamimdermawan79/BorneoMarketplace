import {mkdir,rename,readFile,writeFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const root=fileURLToPath(new URL('../',import.meta.url));
const assets=join(root,'apps/web/public/assets');
const exists=async path=>access(path).then(()=>true,()=>false);
const moves=[['logo.webp','logo/logo.webp'],['background.webp','background/background.webp'],['motif-awan.svg','decoration/motif-awan.svg'],['login-cloud-left.svg','decoration/login-cloud-left.svg'],['login-cloud-right.svg','decoration/login-cloud-right.svg']];
for(const [source,target] of moves){
  const from=join(assets,source),to=join(assets,target);
  if(!await exists(from))continue;
  if(await exists(to))throw new Error(`Destination already exists: ${target}`);
  await mkdir(join(to,'..'),{recursive:true});
  await rename(from,to);
  console.log(`Moved ${source} -> ${target}`);
}
const pattern=join(assets,'decoration/pattern1.png');
if(await exists(pattern)){
  const destination=join(assets,'decoration/pattern1.webp');
  const converted=await sharp(await readFile(pattern),{limitInputPixels:50_000_000}).rotate().webp({lossless:true,effort:6}).toBuffer();
  if(await exists(destination)){
    if(!(await readFile(destination)).equals(converted))throw new Error('Pattern WebP differs from the new PNG; resolve the replacement before cleanup.');
  }else await writeFile(destination,converted,{flag:'wx'});
  if((await sharp(destination).metadata()).format!=='webp')throw new Error('Pattern verification failed');
  // Keep the exact original in ignored backups, not in deployable/public assets.
  const backup=join(root,'backups',`asset-cleanup-${Date.now()}`);
  await mkdir(backup,{recursive:true});
  await rename(pattern,join(backup,'pattern1.png'));
  console.log(`Pattern converted to WebP; PNG preserved in ${backup}`);
}
const logo=join(assets,'logo/logo.webp');
const frames=await Promise.all([16,32,48].map(size=>sharp(logo).resize(size,size,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer()));
const header=Buffer.alloc(6+frames.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(frames.length,4);
let offset=header.length;
frames.forEach((frame,index)=>{const pos=6+index*16;const size=[16,32,48][index];header[pos]=size;header[pos+1]=size;header.writeUInt16LE(1,pos+4);header.writeUInt16LE(32,pos+6);header.writeUInt32LE(frame.length,pos+8);header.writeUInt32LE(offset,pos+12);offset+=frame.length;});
await writeFile(join(assets,'logo/favicon.ico'),Buffer.concat([header,...frames]));
console.log('Generated logo/favicon.ico (16, 32, 48 px).');
