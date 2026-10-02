import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

type SalesRow={order_no:string;needed_date:string|Date;kitchen:string;admin:string;product_name:string;ordered_quantity:number|string;order_unit:string;actual_weight_kg:number|string|null;unit_price:number|string;total:number|string;sources:string};
export async function salesPdf(rows:SalesRow[],period:{from?:string;to?:string;orientation?:'portrait'|'landscape'}){
  // Convert in memory for PDFKit; keep WebP as the sole source asset.
  const logo=await sharp(fileURLToPath(new URL('../../../web/public/assets/logo/logo.webp',import.meta.url))).resize(256,256,{fit:'inside',withoutEnlargement:true}).png().toBuffer();
  const portrait=period.orientation==='portrait';
  const doc=new PDFDocument({size:'A4',layout:portrait?'portrait':'landscape',margin:36,bufferPages:true,info:{Title:'Laporan Keuangan',Author:'Borneo Marketplace'}});
  const chunks:Buffer[]=[];
  const result=new Promise<Buffer>((resolve,reject)=>{doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject)});
  const ink='#222222',line='#777777',width=doc.page.width-72;
  const number=(value:number|string)=>Number(value).toLocaleString('id-ID',{maximumFractionDigits:2});
  const currency=(value:number|string)=>`Rp ${number(value)}`;
  const titleCase=(value:string)=>value.toLocaleLowerCase('id-ID').replace(/\p{L}[\p{L}\p{M}]*/gu,word=>word[0].toLocaleUpperCase('id-ID')+word.slice(1));
  const date=(value:string|Date)=>new Date(value).toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Jakarta'});
  const month=(value:string|Date)=>new Date(value).toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'Asia/Jakarta'});
  const first=period.from||rows[0]?.needed_date,last=period.to||rows[rows.length-1]?.needed_date;
  const range=first&&last?(month(first)===month(last)?month(first):`${month(first)} - ${month(last)}`):'Tidak ada periode transaksi';
  const text=(value:string,x:number,top:number,w:number,size=12,bold=false,align:'left'|'right'|'center'='left')=>{
    doc.font(bold?'Times-Bold':'Times-Roman').fontSize(size).fillColor(ink).text(value,x,top,{width:w,align});
  };
  let y=36;
  const letterhead=()=>{
    doc.image(logo,46,38,{fit:[68,68],align:'center',valign:'center'});
    text('Laporan Keuangan',116,36,width-160,14,true,'center');
    text('Borneo Marketplace',116,55,width-160,14,true,'center');
    text('Sambas, Kalimantan Barat',116,74,width-160,12,false,'center');
    text(`Periode: ${titleCase(range)}`,116,92,width-160,12,false,'center');
    doc.lineWidth(1).moveTo(36,114).lineTo(36+width,114).strokeColor(ink).stroke();
    doc.lineWidth(.4).moveTo(36,117).lineTo(36+width,117).stroke();
    y=132;
  };
  letterhead();
  const total=rows.reduce((sum,row)=>sum+Number(row.total),0);
  text(`Total Transaksi: ${currency(total)}`,36,y,width);y+=18;
  text(`Jumlah Transaksi: ${new Set(rows.map(row=>row.order_no)).size}`,36,y,width);y+=18;
  text(`Jumlah Dapur: ${new Set(rows.map(row=>row.kitchen)).size}`,36,y,width);y+=28;
  // Use the wider landscape page for readable descriptions and balanced numeric columns.
  const fontSize=portrait?10:12;
  const widths=portrait?[80,82,94,60,60,72,width-448]:[106,130,155,84,84,100,width-659];
  const cols=['Tanggal / Invoice','Dapur','Barang','Jumlah Pesanan','Jumlah Aktual','Harga Satuan','Penjualan'].map((label,index)=>({label,width:widths[index]}));
  const header=()=>{
    const height=42;let x=36;
    cols.forEach(col=>{doc.lineWidth(.5).rect(x,y,col.width,height).fillAndStroke('#e5eef4',line);
      doc.font('Times-Bold').fontSize(fontSize);
      const h=doc.heightOfString(col.label,{width:col.width-12});
      text(col.label,x+6,y+(height-h)/2,col.width-12,fontSize,true,'center');x+=col.width;});
    y+=height;
  };
  const next=()=>{doc.addPage();y=36;header();};
  header();
  rows.forEach((row,rowIndex)=>{
    const cells=[date(row.needed_date),titleCase(row.kitchen),titleCase(row.product_name),`${number(row.ordered_quantity)} ${row.order_unit}`,row.actual_weight_kg==null?`${number(row.ordered_quantity)} ${row.order_unit}`:`${number(row.actual_weight_kg)} kg`,currency(row.unit_price),currency(row.total)];
    const heights=cells.map((cell,i)=>{doc.font(i===6?'Times-Bold':'Times-Roman').fontSize(fontSize);return doc.heightOfString(cell,{width:cols[i].width-12});});
    doc.font('Times-Roman').fontSize(9);
    const invoiceHeight=doc.heightOfString(row.order_no,{width:cols[0].width-12});
    const dateHeight=heights[0];
    heights[0]+=3+invoiceHeight;
    const height=Math.max(44,...heights.map(h=>h+16));
    // Keep the last item with its total instead of producing a total-only page.
    const bottomSpace=rowIndex===rows.length-1?128:82;
    if(y+height>doc.page.height-bottomSpace)next();
    let x=36;cells.forEach((cell,i)=>{
      doc.lineWidth(.5).rect(x,y,cols[i].width,height).strokeColor(line).stroke();
      const top=y+(height-heights[i])/2;
      text(cell,x+6,top,cols[i].width-12,fontSize,i===6,'center');
      if(i===0)text(row.order_no,x+6,top+dateHeight+3,cols[i].width-12,9,false,'center');
      x+=cols[i].width;
    });y+=height;
  });
  if(!rows.length){doc.rect(36,y,width,44).strokeColor(line).stroke();text('Tidak Ada Transaksi Pada Periode Ini.',48,y+15,width-24,12,false,'center');y+=44;}
  if(y+68>doc.page.height-60)next();
  const totalWidth=cols[6].width;
  doc.font('Times-Bold').fontSize(fontSize);
  const totalHeight=Math.max(34,doc.heightOfString(currency(total),{width:totalWidth-12})+20);
  doc.rect(36,y,width-totalWidth,totalHeight).strokeColor(line).stroke();
  doc.rect(36+width-totalWidth,y,totalWidth,totalHeight).stroke();
  text('Total Transaksi',42,y+10,width-totalWidth-12,12,true,'center');
  text(currency(total),36+width-totalWidth+6,y+10,totalWidth-12,fontSize,true,'center');y+=totalHeight+9;
  text('Nilai Penjualan Barang, Bukan Penerimaan Pembayaran.',36,y,width,12);
  const pages=doc.bufferedPageRange();
  for(let i=0;i<pages.count;i++){
    doc.switchToPage(i);const fy=doc.page.height-52;
    doc.font('Times-Roman').fontSize(10).fillColor(ink).text(`Dicetak ${new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB`,36,fy,{width:width-110,lineBreak:false});
    doc.text(`Halaman ${i+1} / ${pages.count}`,36+width-100,fy,{width:100,align:'right',lineBreak:false});
  }
  doc.end();return result;
}
