const {parentPort,workerData}=require('node:worker_threads');
const sharp=require('sharp');
const heicConvert=require('heic-convert');

// This worker never reads a user-provided path or URL, and never saves originals.
async function convert(){
  sharp.cache(false);sharp.concurrency(1);
  let input=Buffer.from(workerData.input);
  const options={limitInputPixels:50_000_000,failOn:'error'};
  const metadata=await sharp(input,options).metadata();
  if(!['png','jpeg','webp','heif'].includes(metadata.format)||!metadata.width||!metadata.height||metadata.width*metadata.height>50_000_000)throw Error('Invalid image');
  if(metadata.format==='heif'){
    input=Buffer.from(await heicConvert({buffer:input,format:'PNG'}));
  }
  const output=await sharp(input,options).rotate().resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).webp({quality:82,effort:4}).toBuffer();
  // Keep data URLs within the catalog API payload limit even for noisy photographs.
  const final=output.length<=500_000?output:await sharp(output).resize({width:960,height:960,fit:'inside',withoutEnlargement:true}).webp({quality:70}).toBuffer();
  if(final.length>560_000)throw Error('Image too complex');
  parentPort.postMessage({output:final});
}
convert().catch(()=>parentPort.postMessage({error:true}));
