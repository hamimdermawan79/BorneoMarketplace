import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ReportTable,type ReportRow} from './ReportTable';
const row:ReportRow={order_no:'INV-001',needed_date:'2026-10-10',kitchen:'Dapur Contoh',admin:'Admin',product_name:'Beras',ordered_quantity:10,order_unit:'kg',actual_weight_kg:null,unit_price:15000,total:150000,source_key:'COOPERATIVE',source_label:'Barang Koperasi'};
describe('report source separators',()=>{
  it('shows compact bold group headings without any date headings',()=>{
    const html=renderToStaticMarkup(<ReportTable rows={[row,{...row,product_name:'Kecap'}, {...row,source_key:'VENDOR:a',source_label:'Vendor A'}, {...row,needed_date:'2026-10-11',order_no:'INV-002'}]}/>);
    expect(html.match(/class="report-source-separator"/g)).toHaveLength(3);
    expect(html.match(/scope="rowgroup">Barang Koperasi/g)).toHaveLength(2);
    expect(html).toContain('scope="rowgroup">Vendor A');
    expect(html).not.toMatch(/scope="rowgroup">\d/);
    expect(html).toContain('Rp 15.000');expect(html).toContain('Rp 150.000');
  });
  it('escapes vendor names and supports empty results',()=>{
    expect(renderToStaticMarkup(<ReportTable rows={[{...row,source_label:'Vendor <script>'}]}/>)).not.toContain('<script>');
    expect(renderToStaticMarkup(<ReportTable rows={[]}/>)).toContain('Tidak Ada Transaksi Pada Periode Ini.');
  });
});
