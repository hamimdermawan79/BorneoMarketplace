import {describe,expect,it,vi} from 'vitest';
import PDFDocument from 'pdfkit';
import {salesPdf} from './sales-pdf.js';

const row={order_no:'INV-CONTOH-001',needed_date:'2026-10-03',kitchen:'Dapur Contoh',admin:'Admin Contoh',product_name:'Ayam Potong',ordered_quantity:10,order_unit:'Potong',actual_weight_kg:9,unit_price:30000,total:270000,sources:'COOPERATIVE'};
const pageSizes=(pdf:Buffer)=>[...pdf.toString('latin1').matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(match=>({width:Number(match[1]),height:Number(match[2])}));

describe('landscape financial report PDF',()=>{
  it('prints only source headings per day and never leaves a heading alone at a page end',async()=>{
    const calls:{value:string;page:number;y:number;font:string}[]=[];
    const original=PDFDocument.prototype.text;
    const spy=vi.spyOn(PDFDocument.prototype,'text').mockImplementation(function(this:any,...args:any[]){
      calls.push({value:args[0],page:this._pageBuffer.length,y:args[2],font:this._font.name});
      return (original as any).apply(this,args);
    });
    try{
      const rows=Array.from({length:18},(_,i)=>({...row,needed_date:i<9?'2026-10-10':'2026-10-11',order_no:`INV-${i}`,
        sources:i%3===0?'COOPERATIVE':'VENDOR',source_key:i%3===0?'COOPERATIVE':`VENDOR:${i%3}`,
        source_label:i%3===0?'Barang Koperasi':`Vendor ${i%3===1?'A':'B'}`}));
      await salesPdf(rows,{orientation:'portrait'});
      const labels=calls.filter(call=>call.value==='Barang Koperasi'||call.value==='Vendor A'||call.value==='Vendor B');
      expect(labels.length).toBeGreaterThanOrEqual(6);
      expect(labels.every(call=>call.font==='Times-Bold')).toBe(true);
      for(const label of labels){
        const position=calls.indexOf(label);
        const date=calls.slice(position+1).find(call=>/^\d{2}\/\d{2}\/\d{4}$/.test(call.value));
        expect(date?.page).toBe(label.page);
        expect(date!.y).toBeGreaterThan(label.y);
      }
      expect(calls.filter(call=>call.value==='Laporan Keuangan')).toHaveLength(1);
    }finally{spy.mockRestore()}
  });
  it.each([0,1,40])('supports portrait with %i rows on every page',async count=>{
    const sizes=pageSizes(await salesPdf(Array.from({length:count},()=>row),{orientation:'portrait'}));
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.every(size=>Math.abs(size.width-595.28)<.1&&Math.abs(size.height-841.89)<.1)).toBe(true);
  });
  it('simplifies columns, formats currency and prints the letterhead only once',async()=>{
    const text=vi.spyOn(PDFDocument.prototype,'text');
    try{
      const rows=Array.from({length:20},()=>({...row,kitchen:'dapur contoh',product_name:'ayam potong'}));
      const sizes=pageSizes(await salesPdf(rows,{from:'2026-10-01',to:'2026-10-31'}));
      const values=text.mock.calls.map(call=>call[0]);
      expect(sizes.length).toBeGreaterThan(1);
      expect(values.filter(value=>value==='Laporan Keuangan')).toHaveLength(1);
      expect(values.filter(value=>value==='Tanggal / Invoice')).toHaveLength(sizes.length);
      expect(values).toEqual(expect.arrayContaining(['Dapur','Barang','Dapur Contoh','Ayam Potong','Jumlah Pesanan','Harga Satuan','Rp 30.000','Rp 270.000','Rp 5.400.000']));
      expect(values).not.toEqual(expect.arrayContaining(['Dapur / Admin']));
      expect(values).not.toEqual(expect.arrayContaining(['Barang / Sumber']));
      expect(values.some(value=>typeof value==='string'&&(value.includes(row.admin)||value.includes(row.sources)))).toBe(false);
    }finally{text.mockRestore();}
  });
  it('uses landscape A4 for a populated report',async()=>{
    const sizes=pageSizes(await salesPdf([row],{from:'2026-10-01',to:'2026-10-31'}));
    expect(sizes).toHaveLength(1);
    expect(sizes[0].width).toBeCloseTo(841.89,1);
    expect(sizes[0].height).toBeCloseTo(595.28,1);
  });
  it('keeps every continuation page in landscape',async()=>{
    const rows=Array.from({length:40},(_,index)=>({...row,order_no:`INV-CONTOH-${String(index+1).padStart(3,'0')}`,product_name:'Ayam Potong Segar Ukuran Besar',kitchen:'Dapur Mitra Contoh Kecamatan Sambas'}));
    const sizes=pageSizes(await salesPdf(rows,{from:'2026-10-01',to:'2026-10-31'}));
    expect(sizes.length).toBeGreaterThan(1);
    expect(sizes.every(size=>size.width>size.height&&Math.abs(size.width-841.89)<0.1&&Math.abs(size.height-595.28)<0.1)).toBe(true);
  });
  it('also uses landscape for an empty report',async()=>{
    const sizes=pageSizes(await salesPdf([],{from:'2026-10-01',to:'2026-10-31'}));
    expect(sizes).toHaveLength(1);
    expect(sizes[0].width).toBeGreaterThan(sizes[0].height);
  });
});
