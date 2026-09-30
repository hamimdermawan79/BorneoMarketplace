import type { FastifyInstance } from 'fastify';
import { salesPdf } from './sales-pdf.js';
import { z } from 'zod';
import { pool } from '../database/client.js';
import { allow } from '../types.js';

const filters=z.object({from:z.string().date().optional(),to:z.string().date().optional(),kitchenId:z.string().uuid().optional()}).refine(value=>!value.from||!value.to||value.from<=value.to,{message:'Periode awal harus sebelum periode akhir.'});
const xml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]!));
async function reportRows(user:{id:string;role:string},query:unknown){
  const input=filters.parse(query);const params:unknown[]=[];const clauses=[`o.status IN('SHIPPED','AWAITING_KITCHEN','COMPLETED')`];
  if(user.role==='ADMIN'){params.push(user.id);clauses.push(`o.admin_user_id=$${params.length}`);}
  if(input.kitchenId){params.push(input.kitchenId);clauses.push(`o.kitchen_id=$${params.length}`);}
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
  app.get('/reports/kitchens',{preHandler:allow('SUPERADMIN','ADMIN')},async request=>{
    const params=request.user.role==='ADMIN'?[request.user.id]:[];
    const scope=request.user.role==='ADMIN'?'WHERE o.admin_user_id=$1':'';
    const {rows}=await pool.query(`SELECT DISTINCT k.id,k.name FROM orders o JOIN organizations k ON k.id=o.kitchen_id ${scope} ORDER BY k.name`,params);
    return rows;
  });
  app.get('/reports/sales',{preHandler:allow('SUPERADMIN','ADMIN')},async request=>reportRows(request.user,request.query));
  app.get('/reports/sales.xls',{preHandler:allow('SUPERADMIN','ADMIN')},async(request,reply)=>{
    const rows=await reportRows(request.user,request.query);const headers=['Tanggal','No. Pesanan','Admin','Dapur','Barang','Sumber','Jumlah','Satuan','Berat Aktual (kg)','Harga Jual','Harga Modal','Nilai Penjualan','Estimasi Margin'];
    const body=rows.map(r=>{const basis=Number(r.actual_weight_kg||r.ordered_quantity);const cost=basis*Number(r.unit_cost||0);const values=[new Date(r.needed_date).toLocaleDateString('id-ID'),r.order_no,r.admin,r.kitchen,r.product_name,r.sources,Number(r.ordered_quantity),r.order_unit,r.actual_weight_kg?Number(r.actual_weight_kg):'',Number(r.unit_price),Number(r.unit_cost||0),Number(r.total),Number(r.total)-cost];return `<Row>${values.map((value,index)=>`<Cell${index>=9?' ss:StyleID="Currency"':''}><Data ss:Type="${typeof value==='number'?'Number':'String'}">${xml(value)}</Data></Cell>`).join('')}</Row>`}).join('');
    const workbook=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#164766" ss:Pattern="Solid"/></Style><Style ss:ID="Currency"><NumberFormat ss:Format="[$Rp-421] #,##0"/></Style></Styles><Worksheet ss:Name="Laporan Keuangan"><Table><Row>${headers.map(h=>`<Cell ss:StyleID="Header"><Data ss:Type="String">${xml(h)}</Data></Cell>`).join('')}</Row>${body}</Table></Worksheet></Workbook>`;
    reply.header('Content-Type','application/vnd.ms-excel; charset=utf-8').header('Content-Disposition','attachment; filename="laporan-keuangan-borneo.xls"');return reply.send(Buffer.from(workbook,'utf8'));
  });

  app.get('/reports/sales.pdf',{preHandler:allow('SUPERADMIN','ADMIN')},async(request,reply)=>{
    const rows=await reportRows(request.user,request.query);
    const pdf=await salesPdf(rows,filters.parse(request.query));
    reply.header('Content-Type','application/pdf').header('Content-Disposition','attachment; filename="laporan-penjualan-borneo.pdf"');return reply.send(pdf);
  });
}
