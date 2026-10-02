import {describe,it,expect} from 'vitest';
import sharp from 'sharp';
import {convertToWebp,MAX_IMAGE_BYTES} from './convert.js';

describe('product image conversion',()=>{
  for(const format of ['png','jpeg','webp'] as const){
    it(`decodes ${format}, resizes and strips metadata`,async()=>{
      const input=await sharp({create:{width:1600,height:800,channels:3,background:'#aaddff'}}).withExif({IFD0:{Artist:'Private owner'}}).toFormat(format).toBuffer();
      const output=await convertToWebp(input),metadata=await sharp(output).metadata();
      expect(metadata.format).toBe('webp');expect(metadata.width).toBe(1280);expect(metadata.height).toBe(640);expect(metadata.exif).toBeUndefined();
    });
  }
  it('keeps PNG transparency',async()=>{
    const input=await sharp({create:{width:8,height:8,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).png().toBuffer();
    expect((await sharp(await convertToWebp(input)).metadata()).hasAlpha).toBe(true);
  });
  it('rejects fake, corrupt, empty, SVG and oversized input',async()=>{
    for(const input of [Buffer.alloc(0),Buffer.from('<svg/>'),Buffer.from('not an image'),Buffer.from([255,216,255,1,2,3]),Buffer.alloc(MAX_IMAGE_BYTES+1)])await expect(convertToWebp(input)).rejects.toMatchObject({statusCode:400});
  });
  it('rejects a decompression bomb header before decoding',async()=>{
    const input=await sharp({create:{width:1,height:1,channels:3,background:'#fff'}}).png().toBuffer();
    input.writeUInt32BE(100000,16);input.writeUInt32BE(100000,20);
    await expect(convertToWebp(input)).rejects.toMatchObject({statusCode:400});
  });
});
