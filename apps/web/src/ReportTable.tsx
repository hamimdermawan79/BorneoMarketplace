export type ReportRow={order_no:string;needed_date:string;kitchen:string;admin:string;product_name:string;ordered_quantity:string|number;order_unit:string;actual_weight_kg:string|number|null;unit_price:string|number;total:string|number;source_key:string;source_label:string};
const number=(v:string|number)=>Number(v).toLocaleString('id-ID',{maximumFractionDigits:3});
const titleCase=(v:string)=>v.toLocaleLowerCase('id-ID').replace(/\p{L}[\p{L}\p{M}]*/gu,word=>word[0].toLocaleUpperCase('id-ID')+word.slice(1));
export function ReportTable({rows}:{rows:ReportRow[]}){
  const groups:{key:string;label:string;rows:ReportRow[]}[]=[];
  for(const row of rows){
    const day=new Date(row.needed_date).toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});
    const key=`${day}|${row.source_key}`;
    if(groups[groups.length-1]?.key!==key)groups.push({key,label:row.source_label,rows:[]});
    groups[groups.length-1].rows.push(row);
  }
  return <table className="stock-table report-preview"><thead><tr>{['Tanggal / Invoice','Dapur','Barang','Jumlah Pesanan','Jumlah Aktual','Harga Satuan','Penjualan'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead>
    {groups.map(group=><tbody key={group.key}>
      <tr className="report-source-separator"><th colSpan={7} scope="rowgroup">{titleCase(group.label)}</th></tr>
      {group.rows.map((row,i)=><tr key={`${row.order_no}-${i}`}><td>{new Date(row.needed_date).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta'})}<small>{row.order_no}</small></td><td>{titleCase(row.kitchen)}</td><td>{titleCase(row.product_name)}</td><td>{number(row.ordered_quantity)} {row.order_unit}</td><td>{row.actual_weight_kg==null?`${number(row.ordered_quantity)} ${row.order_unit}`:`${number(row.actual_weight_kg)} kg`}</td><td>Rp {number(row.unit_price)}</td><td>Rp {number(row.total)}</td></tr>)}
    </tbody>)}
    {!rows.length&&<tbody><tr><td colSpan={7}>Tidak Ada Transaksi Pada Periode Ini.</td></tr></tbody>}
  </table>;
}
