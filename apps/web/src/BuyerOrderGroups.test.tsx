import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('./api',()=>({session:{token:null}}));
import {BuyerOrderGroups} from './BuyerPanel';

const order={id:'order-1',orderNo:'INV-000001',status:'SHIPPED',neededDate:'2026-10-03',kitchen:'Dapur Manggis',estimatedTotal:220018,finalTotal:null,currentTotal:220018,createdAt:'2026-10-02',items:[
  {id:'item-1',name:'Kentang',quantity:10,orderUnit:'KG',priceUnit:'KG',unitPrice:10000,actualWeightKg:null},
  {id:'item-2',name:'Kecap',quantity:1,orderUnit:'Botol',priceUnit:'Botol',unitPrice:10000,actualWeightKg:null},
  {id:'item-3',name:'Ayam Potong',quantity:10,orderUnit:'Potong',priceUnit:'kg',unitPrice:30000,actualWeightKg:9}
]};

describe('buyer order status hierarchy',()=>{
  it.each([false,true])('shows one status in the header and none per item (compact=%s)',compact=>{
    const html=renderToStaticMarkup(<BuyerOrderGroups orders={[order]} confirm={vi.fn()} compact={compact}/>);
    expect(html.match(/Dalam pengiriman/g)).toHaveLength(1);
    expect(html).toMatch(/<header>[\s\S]*Dalam pengiriman[\s\S]*<\/header>/);
    expect(html.split('class="buyer-order-lines"')[1].split('<footer>')[0]).not.toContain('Dalam pengiriman');
    expect(html).toContain('10 Potong · 9 kg');
    expect(html).toContain('220.018');
  });
  it('keeps separate orders and their statuses even when kitchen and date match',()=>{
    const html=renderToStaticMarkup(<BuyerOrderGroups orders={[order,{...order,id:'order-2',orderNo:'INV-000002',status:'AWAITING_KITCHEN'}]} confirm={vi.fn()}/>);
    expect(html.match(/class="buyer-order-card"/g)).toHaveLength(2);
    expect(html.match(/class="order-state"/g)).toHaveLength(2);
    expect(html.match(/Konfirmasi diterima/g)).toHaveLength(1);
    expect(html).toContain('Pesanan INV-000001');
    expect(html).toContain('Pesanan INV-000002');
  });
});
