import PDFDocument from 'pdfkit';

type SalesRow={order_no:string;needed_date:string|Date;kitchen:string;admin:string;product_name:string;ordered_quantity:number|string;order_unit:string;actual_weight_kg:number|string|null;unit_price:number|string;total:number|string;sources:string};
export async function salesPdf(rows:SalesRow[],period:{from?:string;to?:string}){
  const doc=new PDFDocument({size:'A4',layout:'landscape',margin:36,bufferPages:true});
  const chunks:Buffer[]=[];
  const result=new Promise<Buffer>((resolve,reject)=>{doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject)});
  const ink='#222222',muted='#666666',line='#999999';
  const number=(value:number|string)=>Number(value).toLocaleString('id-ID',{maximumFractionDigits:2});
  const date=(value:string|Date)=>new Date(value).toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Jakarta'});
  const width=doc.page.width-72;
  let y=36;
  const text=(value:string,x:number,top:number,w:number,size=9,bold=false,align:'left'|'right'|'center'='left')=>{doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(size).fillColor(ink).text(value,x,top,{width:w,align})};
  text('KOPERASI BORNEO MANDIRI',36,y,width,12,true);y+=22;
  text('LAPORAN PENJUALAN',36,y,width,16,true);y+=24;
  const month=(value:string|Date)=>new Date(value).toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'Asia/Jakarta'});
  const first=period.from||rows[0]?.needed_date;const last=period.to||rows[rows.length-1]?.needed_date;
  const range=first&&last?(month(first)===month(last)?month(first):`${month(first)} - ${month(last)}`):'Tidak ada periode transaksi';
  text(`Periode: ${range}`,36,y,width,9);y+=18;
  y+=4;
  const total=rows.reduce((sum,row)=>sum+Number(row.total),0);
  const metrics=[['NILAI PENJUALAN',`Rp ${number(total)}`],['PESANAN',String(new Set(rows.map(row=>row.order_no)).size)],['DAPUR',String(new Set(rows.map(row=>row.kitchen)).size)]];
  metrics.forEach(([label,value],i)=>{const x=36+i*width/3;text(label,x,y+10,width/3-20,8);text(value,x,y+27,width/3-20,13,true)});y+=70;
  const cols=[{label:'Tanggal / Invoice',width:113},{label:'Dapur / Admin',width:125},{label:'Barang / Sumber',width:150},{label:'Jumlah pesanan',width:89},{label:'Jumlah aktual',width:75},{label:'Harga satuan',width:100},{label:'Penjualan',width:width-652}];
  const header=()=>{let x=36;cols.forEach(col=>{doc.lineWidth(.5).rect(x,y,col.width,29).fillAndStroke('#e5eef4',line);doc.font('Helvetica-Bold').fontSize(8).fillColor(ink).text(col.label,x+7,y+8,{width:col.width-14,align:'center'});x+=col.width});y+=29};
  const next=()=>{doc.addPage();y=36;text('KOPERASI BORNEO MANDIRI | LAPORAN PENJUALAN',36,y,width,10,true);y+=25;header()};
  header();
  rows.forEach(row=>{
    const cells=[`${date(row.needed_date)}\n${row.order_no}`,`${row.kitchen}\n${row.admin}`,`${row.product_name}\n${(row.sources||'').replaceAll('COOPERATIVE','Koperasi').replaceAll('VENDOR','Vendor')}`,`${number(row.ordered_quantity)} ${row.order_unit}`,row.actual_weight_kg==null?`${number(row.ordered_quantity)} ${row.order_unit}`:`${number(row.actual_weight_kg)} kg`,number(row.unit_price),number(row.total)];
    doc.font('Helvetica').fontSize(8);
    const height=Math.max(42,...cells.map((cell,i)=>doc.heightOfString(cell,{width:cols[i].width-14})+18));
    if(y+height>doc.page.height-82)next();
    let x=36;cells.forEach((cell,i)=>{doc.lineWidth(.5).rect(x,y,cols[i].width,height).strokeColor(line).stroke();text(cell,x+7,y+9,cols[i].width-14,8,i===6,'center');x+=cols[i].width});
    y+=height;
  });
  if(!rows.length){doc.rect(36,y,width,48).strokeColor(line).stroke();text('Tidak ada transaksi pada periode ini.',48,y+16,width-24,10,false,'center');y+=48}
  if(y+70>doc.page.height-60)next();
  const totalWidth=cols[6].width;doc.rect(36,y,width-totalWidth,33).strokeColor(line).stroke();doc.rect(36+width-totalWidth,y,totalWidth,33).stroke();text('TOTAL PENJUALAN (Rp)',46,y+11,width-totalWidth-20,9,true,'center');text(number(total),36+width-totalWidth+7,y+10,totalWidth-14,10,true,'center');y+=45;
  text('Nilai dalam rupiah. Laporan ini mencatat penjualan barang, bukan penerimaan pembayaran.',36,y,width,8);
  const pages=doc.bufferedPageRange();
  for(let i=0;i<pages.count;i++){doc.switchToPage(i);const fy=doc.page.height-48;doc.moveTo(36,fy-9).lineTo(36+width,fy-9).strokeColor(line).stroke();doc.font('Helvetica').fontSize(8).fillColor(muted).text(`Dicetak ${new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB`,36,fy,{width:width-110,lineBreak:false});doc.text(`Halaman ${i+1} / ${pages.count}`,36+width-100,fy,{width:100,align:'right',lineBreak:false})}
  doc.end();return result;
}
