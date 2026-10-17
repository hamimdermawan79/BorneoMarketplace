import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('./api',()=>({api:vi.fn()}));
import {OrderCard} from './OrderCard';
import {OrderEdits,type Order} from './admin-order-updates';
const order:Order={id:'o',orderNo:'ORD-1',status:'SUBMITTED',neededDate:'2026-10-17',kitchen:'Dapur Uji',estimatedTotal:24000,finalTotal:null,items:[{id:'i',name:'Beras',quantity:2,orderUnit:'kg',priceUnit:'kg',unitPrice:12000,estimatedWeightKg:null,actualWeightKg:null,prepared:false,allocations:[{id:'a',source:'COOPERATIVE',vendor:null,quantity:2,prepared:false}]}]};
describe('order card save feedback',()=>{
  it('keeps a submitted checklist separate from the explicit start preparation action',()=>{
    const html=renderToStaticMarkup(<OrderCard order={order} admin/>);
    expect(html).toContain('Mulai siapkan');expect(html).not.toContain('Kirim pesanan');
    expect(html).toContain('aria-label="Siapkan Beras dari koperasi"');expect(html).toContain('aria-live="polite"');
  });
  it('shows immediate checked and saving state while disabling only the in-flight checkbox',()=>{
    const edits=new OrderEdits();void edits.save('allocation:a','o',true,()=>new Promise(()=>{}));
    const html=renderToStaticMarkup(<OrderCard order={order} admin edits={edits}/>);
    expect(html).toContain('checked=""');expect(html).toContain('disabled=""');expect(html).toContain('Menyimpan…');
    expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>Mulai siapkan<\/button>/);
  });
  it('shows a disabled status button while another mounted card instance is updating that order',()=>{
    const edits=new OrderEdits();edits.beginStatus(['o']);
    const html=renderToStaticMarkup(<OrderCard order={order} admin edits={edits}/>);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-busy="true"/);expect(html).toContain('Menyimpan…');
  });
  it('keeps the latest server checkbox value when rendering again after a page refresh',()=>{
    const restored={...order,items:order.items.map(item=>({...item,prepared:true,allocations:item.allocations.map(allocation=>({...allocation,prepared:true}))}))};
    const html=renderToStaticMarkup(<OrderCard order={restored} admin/>);
    expect(html).toContain('checked=""');expect(html).toContain('Mulai siapkan');expect(html).not.toContain('Gagal disimpan');
  });
});
