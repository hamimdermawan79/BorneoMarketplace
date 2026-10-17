import {useEffect,useState} from 'react';
import {api,download} from './api';
import {PdfOrientationDialog} from './PdfOrientationDialog';
import {ReportTable,type ReportRow as Row} from './ReportTable';
const number=(v:string|number)=>Number(v).toLocaleString('id-ID',{maximumFractionDigits:2});
const monthLabel=(v:string)=>new Date(`${v}-01T12:00:00`).toLocaleDateString('id-ID',{month:'long',year:'numeric'});
export function ReportsView(){
  const now=new Date();const initial=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const[from,setFrom]=useState(initial);const[to,setTo]=useState(initial);const[rows,setRows]=useState<Row[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState('');const[exporting,setExporting]=useState(false);const[loadedQuery,setLoadedQuery]=useState('');
  const[kitchenId,setKitchenId]=useState('');const[kitchens,setKitchens]=useState<{id:string;name:string}[]>([]);
  const [pdfChoice,setPdfChoice]=useState(false);
  // Keep the chooser scoped to this report and preserve native dialog focus handling.
  useEffect(()=>{setPdfChoice(false)},[from,to,kitchenId]);
  useEffect(()=>{api<{id:string;name:string}[]>('/reports/kitchens').then(setKitchens).catch(()=>setError('Daftar dapur gagal dimuat. Silakan muat ulang halaman.'))},[]);
  const valid=Boolean(from&&to&&from<=to);const lastDay=valid?new Date(Number(to.slice(0,4)),Number(to.slice(5,7)),0).getDate():1;
  const query=`from=${from}-01&to=${to}-${lastDay}${kitchenId?`&kitchenId=${encodeURIComponent(kitchenId)}`:''}`;
  useEffect(()=>{let current=true;setLoadedQuery('');setError('');if(!valid){setLoading(false);return}setLoading(true);api<Row[]>(`/reports/sales?${query}`).then(data=>{if(current){setRows(data);setLoadedQuery(query)}}).catch(reason=>{if(current)setError(reason.message)}).finally(()=>{if(current)setLoading(false)});return()=>{current=false}},[query,valid]);
  const ready=valid&&!loading&&loadedQuery===query&&!error;
  const get=async(type:'pdf'|'xls',orientation?:'portrait'|'landscape')=>{if(!ready||exporting)return;if(type==='pdf'&&!orientation){setPdfChoice(true);return}setPdfChoice(false);setExporting(true);try{await download(`/reports/sales.${type}?${query}${type==='pdf'?`&orientation=${orientation}`:''}`,`laporan-penjualan-${from}-${to}${type==='pdf'?`-${orientation}`:''}.${type}`)}catch(reason){setError((reason as Error).message)}finally{setExporting(false)}};
  return <>
    {pdfChoice&&<PdfOrientationDialog onClose={()=>setPdfChoice(false)} onConfirm={orientation=>void get('pdf',orientation)}/>}
    <header className="page-heading"><h1>Laporan Keuangan</h1></header>
    <section className="panel">
      <div className="report-controls">
        <label>Dari Bulan<input type="month" value={from} onChange={e=>setFrom(e.target.value)}/></label>
        <label>Sampai Bulan<input type="month" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label>
        <label>Dapur<select value={kitchenId} onChange={event=>setKitchenId(event.target.value)}><option value="">Semua Dapur</option>{kitchens.map(kitchen=><option value={kitchen.id} key={kitchen.id}>{kitchen.name}</option>)}</select></label>
        <div><button disabled={!ready||exporting} onClick={()=>get('pdf')}>Unduh PDF</button><button className="primary" disabled={!ready||exporting} onClick={()=>get('xls')}>Unduh Excel</button></div>
      </div>
      {!valid?<p role="alert">Periksa bulan awal dan akhir.</p>:<h2 className="report-period">{from===to?monthLabel(from):`${monthLabel(from)} - ${monthLabel(to)}`}</h2>}
      {error&&<p className="form-error" role="alert">{error}</p>}
      {loading?<p role="status">Memuat laporan…</p>:ready&&<>
        <div className="report-summary"><span>Total Penjualan <strong>Rp {number(rows.reduce((sum,row)=>sum+Number(row.total),0))}</strong></span><span>{new Set(rows.map(row=>row.order_no)).size} Pesanan</span></div>
        <div className="stock-table-wrap"><ReportTable rows={rows}/></div>
      </>}
    </section>
  </>;
}
