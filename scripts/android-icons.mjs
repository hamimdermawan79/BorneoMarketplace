import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(repo,'apps/api/package.json'));
const sharp=require('sharp');
const publicDirectory=path.join(repo,'apps/web/public');
const source=path.join(publicDirectory,'assets/logo/app-icon.webp');
// Import the supplied artwork once; subsequent builds use the versioned repo asset.
const importPath=process.argv[2];
if(importPath){
  await sharp(path.resolve(importPath)).rotate().webp({lossless:true}).toFile(source);
}
const directory=path.join(repo,'apps/android/app/src/main/res/drawable-nodpi');
await mkdir(directory,{recursive:true});
await sharp(source)
  .resize(432,432,{fit:'contain',background:{r:255,g:255,b:255,alpha:0}})
  .webp({lossless:true}).toFile(path.join(directory,'borneo_logo.webp'));
// Keep the Android artwork transparent beyond its own cyan rim. iOS uses an
// opaque square and supplies its own corner mask: use cyan, never an extra white tile.
await sharp(source).resize(180,180,{fit:'contain',background:{r:255,g:255,b:255,alpha:0}})
  .flatten({background:'#2dcfe2'}).png().toFile(path.join(publicDirectory,'apple-touch-icon-v3.png'));
console.log('Android launcher and iOS Home Screen icons generated from the supplied artwork.');
