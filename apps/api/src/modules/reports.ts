import type { FastifyInstance } from 'fastify';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { pool } from '../database/client.js';
import { allow } from '../types.js';

const filters=z.object({from:z.string().date().optional(),to:z.string().date().optional()});
const xml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]!));
async function reportRows(user:{id:string;role:string},query:unknown){
  const input=filters.parse(query);const params:unknown[]=[];const clauses=[`o.status IN('SHIPPED','AWAITING_KITCHEN','COMPLETED')`];
  if(user.role==='ADMIN'){params.push(user.id);clauses.push(`o.admin_user_id=$${params.length}`);}
  if(input.from){params.push(input.from);clauses.push(`o.needed_date>=$${params.length}`);}
  if(input.to){params.push(input.to);clauses.push(`o.needed_date<=$${params.length}`);}
  const {rows}=await pool.query(`SELECT o.order_no,o.needed_date,k.name AS kitchen,u.full_name AS admin,oi.product_name,
    oi.ordered_quantity,oi.order_unit,oi.actual_weight_kg,oi.unit_price,COALESCE(oi.final_total,oi.estimated_total) AS total,
    string_agg(DISTINCT a.source::text,', ') AS sources,COALESCE(sum(COALESCE(a.actual_quantity,a.reserved_quantity)*b.cost_price)/NULLIF(sum(COALESCE(a.actual_quantity,a.reserved_quantity)),0),0) AS unit_cost
    FROM orders o JOIN organizations k ON k.id=o.kitchen_id JOIN users u ON u.id=o.admin_user_id JOIN order_items oi ON oi.order_id=o.id
    LEFT JOIN order_item_allocations a ON a.order_item_id=oi.id LEFT JOIN inventory_batches b ON b.id=a.inventory_batch_id
    WHERE ${clauses.join(' AND ')} GROUP BY o.id,k.name,u.full_name,oi.id ORDER BY o.needed_date,o.order_no,oi.product_name`,params);
  return rows;
}

export async function reportRoutes(app:FastifyInstance){
  app.get('/reports/sales.xls',{preHandler:allow('SUPERADMIN','ADMIN')},async(request,reply)=>{
    const rows=await reportRows(request.user,request.query);const headers=['Tanggal','No. Pesanan','Admin','Dapur','Barang','Sumber','Jumlah','Satuan','Berat Aktual (kg)','Harga Jual','Harga Modal','Nilai Penjualan','Estimasi Margin'];
    const body=rows.map(r=>{const basis=Number(r.actual_weight_kg||r.ordered_quantity);const cost=basis*Number(r.unit_cost||0);const values=[new Date(r.needed_date).toLocaleDateString('id-ID'),r.order_no,r.admin,r.kitchen,r.product_name,r.sources,Number(r.ordered_quantity),r.order_unit,r.actual_weight_kg?Number(r.actual_weight_kg):'',Number(r.unit_price),Number(r.unit_cost||0),Number(r.total),Number(r.total)-cost];return `<Row>${values.map((value,index)=>`<Cell${index>=9?' ss:StyleID="Currency"':''}><Data ss:Type="${typeof value==='number'?'Number':'String'}">${xml(value)}</Data></Cell>`).join('')}</Row>`}).join('');
    const workbook=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#164766" ss:Pattern="Solid"/></Style><Style ss:ID="Currency"><NumberFormat ss:Format="[$Rp-421] #,##0"/></Style></Styles><Worksheet ss:Name="Laporan Keuangan"><Table><Row>${headers.map(h=>`<Cell ss:StyleID="Header"><Data ss:Type="String">${xml(h)}</Data></Cell>`).join('')}</Row>${body}</Table></Worksheet></Workbook>`;
    reply.header('Content-Type','application/vnd.ms-excel; charset=utf-8').header('Content-Disposition','attachment; filename="laporan-keuangan-borneo.xls"');return reply.send(Buffer.from(workbook,'utf8'));
  });

  app.get('/reports/sales.pdf',{preHandler:allow('SUPERADMIN','ADMIN')},async(request,reply)=>{
    const rows=await reportRows(request.user,request.query);const chunks:Buffer[]=[];const doc=new PDFDocument({margin:42,size:'A4'});doc.on('data',chunk=>chunks.push(chunk));
    doc.fontSize(18).fillColor('#0F2740').text('Laporan Penjualan Koperasi Borneo Mandiri');doc.moveDown(.4).fontSize(9).fillColor('#637B90').text(`Dicetak ${new Intl.DateTimeFormat('id-ID',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date())}`);doc.moveDown();
    const total=rows.reduce((sum,r)=>sum+Number(r.total),0);doc.fontSize(12).fillColor('#0F2740').text(`Total penjualan: Rp${new Intl.NumberFormat('id-ID').format(total)}`);doc.text(`Jumlah baris transaksi: ${rows.length}`);doc.moveDown();
    for(const r of rows){if(doc.y>730)doc.addPage();doc.fontSize(10).fillColor('#0F2740').text(`${r.order_no} · ${r.kitchen}`,{continued:true}).fillColor('#637B90').text(`  ${new Date(r.needed_date).toLocaleDateString('id-ID')}`);doc.fontSize(9).fillColor('#334155').text(`${r.product_name} — ${r.ordered_quantity} ${r.order_unit}${r.actual_weight_kg?` / ${r.actual_weight_kg} kg`:''} — ${r.sources}`);doc.text(`Nilai: Rp${new Intl.NumberFormat('id-ID').format(Number(r.total))}`);doc.moveDown(.6);}
    doc.end();await new Promise<void>(resolve=>doc.on('end',resolve));reply.header('Content-Type','application/pdf').header('Content-Disposition','attachment; filename="laporan-penjualan-borneo.pdf"');return reply.send(Buffer.concat(chunks));
  });
}
