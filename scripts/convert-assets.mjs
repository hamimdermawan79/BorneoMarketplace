import {readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const root=fileURLToPath(new URL('../apps/web/public/assets/',import.meta.url));
async function walk(directory){
  const paths=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(entry.isSymbolicLink())throw Error('Refusing asset symlink');
    const path=join(directory,entry.name);
    if(entry.isDirectory())paths.push(...await walk(path));
    else if(/\.(png|jpe?g)$/i.test(entry.name))paths.push(path);
  }
  return paths;
}
let before=0,after=0;
for(const source of await walk(root)){
  const input=await readFile(source),destination=source.replace(/\.(png|jpe?g)$/i,'.webp');
  const logo=/^logo(?:[\\/]|\.)/i.test(relative(root,source));
  const pipeline=()=>sharp(input,{limitInputPixels:50_000_000}).rotate().resize({width:logo?1024:1920,height:logo?1024:1920,fit:'inside',withoutEnlargement:true});
  let output=await pipeline().webp(logo?{lossless:true}:{quality:82,effort:6}).toBuffer();
  if(!logo&&output.length>input.length)output=await pipeline().webp({quality:68,effort:6}).toBuffer();
  const metadata=await sharp(output).metadata();
  if(metadata.format!=='webp'||!metadata.width||!metadata.height)throw Error('Output verification failed');
  await writeFile(resolve(destination),output,{flag:'wx'});
  before+=input.length;after+=output.length;
  console.log(`${relative(root,source)} -> ${relative(root,destination)}: ${input.length} -> ${output.length} bytes`);
}
console.log(JSON.stringify({before,after,savedPercent:before?Math.round((1-after/before)*100):0}));
console.log('Originals retained. Update references, verify build, then remove only the converted originals.');
