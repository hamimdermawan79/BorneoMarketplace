import {Worker} from 'node:worker_threads';

export const MAX_IMAGE_BYTES=8*1024*1024;
let running=0;
const invalid=()=>Object.assign(new Error('Gambar tidak valid atau tidak didukung. Gunakan PNG, JPG, JPEG, WebP, atau HEIC/HEIF (maksimal 8 MB dan 50 megapiksel).'),{statusCode:400});

export function convertToWebp(input:Buffer):Promise<Buffer>{
  if(!Buffer.isBuffer(input)||!input.length||input.length>MAX_IMAGE_BYTES)return Promise.reject(invalid());
  const raster=input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||
    (input[0]===255&&input[1]===216&&input[2]===255)||
    (input.toString('ascii',0,4)==='RIFF'&&input.toString('ascii',8,12)==='WEBP');
  const heif=input.toString('ascii',4,8)==='ftyp'&&/heic|heix|hevc|hevx|mif1|msf1/.test(input.toString('ascii',8,64));
  if(!raster&&!heif)return Promise.reject(invalid());
  if(running>=2)return Promise.reject(Object.assign(new Error('Pemrosesan gambar sedang penuh. Coba lagi sebentar.'),{statusCode:429}));
  running++;
  return new Promise<Buffer>((resolve,reject)=>{
    let worker:Worker;
    try{worker=new Worker(new URL('./convert-worker.cjs',import.meta.url),{workerData:{input},resourceLimits:{maxOldGenerationSizeMb:256},execArgv:[]});}
    catch(error){running--;reject(error);return;}
    let settled=false;
    const finish=(output?:Uint8Array)=>{
      if(settled)return;settled=true;clearTimeout(timer);
      void worker.terminate().finally(()=>{running--;if(output)resolve(Buffer.from(output));else reject(invalid());});
    };
    const timer=setTimeout(()=>finish(),20_000);
    worker.once('message',(result:{output?:Uint8Array})=>finish(result.output));
    worker.once('error',()=>finish());
    worker.once('exit',()=>{if(!settled)finish();});
  });
}
