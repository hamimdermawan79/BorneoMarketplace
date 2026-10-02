import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('./api',()=>({session:{token:null}}));
import {BuyerCatalogProduct} from './BuyerPanel';

describe('minimal buyer catalog product',()=>{
  it('shows only category, product name, and price/unit below its image',()=>{
    const product={id:'p1',sku:'AYAM',name:'Ayam Potong',category:'Protein',image:'/photo.webp',orderUnit:'Potong',priceUnit:'kg',weighingRequired:true,estimatedKgPerUnit:0.8,salePrice:30000,availableStock:63.8};
    const html=renderToStaticMarkup(<BuyerCatalogProduct product={product} onSelect={vi.fn()}/>);
    expect(html).toContain('Protein');
    expect(html).toContain('Ayam Potong');
    expect(html).toContain('30.000');
    expect(html).toContain('/ kg');
    expect(html).toContain('aria-label="Pesan Ayam Potong"');
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain('Tersedia');
    expect(html).not.toContain('63,8');
    expect(html).not.toContain('Est.');
    expect(html).not.toContain('di keranjang');
  });
});
