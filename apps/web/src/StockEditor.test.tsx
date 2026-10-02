import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('./api',()=>({api:vi.fn(),session:{},download:vi.fn()}));
import {StockEditor} from './StockEditor';
import {Inventory} from './App';
describe('stock edit dialog',()=>{
  it('loads scoped stock before enabling submission',()=>{
    const html=renderToStaticMarkup(<StockEditor product={{id:'product',name:'Ayam Potong',priceUnit:'kg'}} onClose={()=>{}} onSaved={async()=>{}}/>);
    expect(html).toContain('role="dialog"');expect(html).toContain('aria-modal="true"');expect(html).toContain('Memuat stok');expect(html).toContain('class="primary" disabled=""');
  });
  it('still offers editing after an added product runs out of available stock',()=>{
    const product={id:'product',sku:'AP-001',name:'Ayam Potong',category:'Protein',image:null,orderUnit:'Potong',priceUnit:'kg',weighingRequired:true,estimatedKgPerUnit:.8,stockSource:'COOPERATIVE' as const,isMaster:true,hasStock:true,salePrice:30000,availableStock:0,cooperativeStock:0,vendorStock:0};
    const html=renderToStaticMarkup(<Inventory catalog={[product]} vendors={[]} reload={async()=>{}} notify={()=>{}} message=""/>);
    expect(html).toContain('Ayam Potong');expect(html).toContain('Edit stok');expect(html).not.toContain('Belum ada stok');
  });
});
