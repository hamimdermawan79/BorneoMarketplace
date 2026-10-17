import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {StockSelect} from './StockSelect';
describe('stock dropdown',()=>{
  it('retains the native select, label and form values with one decorative arrow',()=>{
    const html=renderToStaticMarkup(<label>Nama Barang<StockSelect name="adminProductId" value="a" required onChange={vi.fn()}><option value="">Pilih Produk</option><option value="a">Ayam Potong</option></StockSelect></label>);
    expect(html).toContain('<select name="adminProductId" required="">');
    expect(html).toContain('<option value="a" selected="">Ayam Potong</option>');
    expect(html.match(/<svg/g)).toHaveLength(1);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<button');
  });
  it('can disable the picker while saving',()=>{
    const html=renderToStaticMarkup(<StockSelect disabled aria-label="Produk Tambahan"><option>Baru</option></StockSelect>);
    expect(html).toContain('disabled=""');expect(html).toContain('aria-label="Produk Tambahan"');
  });
});
