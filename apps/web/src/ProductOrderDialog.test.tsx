import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('./api',()=>({session:{token:null}}));
import {ProductOrderDialog,adjustProductQuantity} from './ProductOrderDialog';

const product={name:'Kecap',image:null,orderUnit:'Botol',priceUnit:'Botol',salePrice:10000,availableStock:89,weighingRequired:false,estimatedKgPerUnit:null};
const props={product,quantity:'2',onQuantityChange:vi.fn(),onAdd:vi.fn(),onClose:vi.fn()};

describe('compact product ordering',()=>{
  it('provides an accessible compact form with a labeled quantity and one primary action',()=>{
    const html=renderToStaticMarkup(<ProductOrderDialog {...props}/>);
    expect(html).toContain('aria-label="Pesan produk Kecap"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('for="product-order-quantity-input"');
    expect(html).toContain('aria-label="Kurangi jumlah"');
    expect(html).toContain('aria-label="Tambah jumlah"');
    expect(html).toContain('20.000');
    expect(html).toContain('Tambah ke keranjang');
    expect(html).not.toContain('Batal');
    expect(html).toContain('Tersedia 89 Botol');
    expect(html).toContain('aria-describedby="product-order-stock"');
  });
  it('shows the estimated total and weighing note for whole-unit weighted products',()=>{
    const html=renderToStaticMarkup(<ProductOrderDialog {...props} product={{...product,name:'Ayam Potong',orderUnit:'Potong',priceUnit:'kg',salePrice:30000,weighingRequired:true,estimatedKgPerUnit:0.8}} quantity="3"/>);
    expect(html).toContain('72.000');
    expect(html).toContain('Estimasi total');
    expect(html).toContain('Harga akhir mengikuti berat aktual');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('step="1"');
  });
  it('disables adding invalid quantities and explains the correction',()=>{
    const html=renderToStaticMarkup(<ProductOrderDialog {...props} quantity="0"/>);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('product-order-submit" disabled');
    expect(html).toContain('Masukkan jumlah positif');
  });
  it('keeps decimal precision and never steps below the valid minimum',()=>{
    expect(adjustProductQuantity('1.125',1,false)).toBe('2.125');
    expect(adjustProductQuantity('0.125',-1,false)).toBe('0.001');
    expect(adjustProductQuantity('1',-1,true)).toBe('1');
    expect(adjustProductQuantity('1000000',1,true)).toBe('1000000');
  });
  it('recovers empty or invalid drafts without creating an invalid quantity',()=>{
    expect(adjustProductQuantity('',1,true)).toBe('1');
    expect(adjustProductQuantity('NaN',-1,false)).toBe('1');
    expect(adjustProductQuantity('1.5',1,true)).toBe('1');
  });
});
