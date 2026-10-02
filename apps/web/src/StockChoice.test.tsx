import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {StockChoice} from './StockChoice';

describe('StockChoice',()=>{
  const props={name:'productMode',label:'Jenis produk',value:'TEMPLATE',options:[{value:'TEMPLATE',label:'Pokok'},{value:'CUSTOM',label:'Baru'}],onChange:vi.fn()};
  it('keeps native radio semantics and a named group',()=>{
    const html=renderToStaticMarkup(<StockChoice {...props}/>);
    expect(html).toContain('<legend>Jenis produk *</legend>');
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html.match(/name="productMode"/g)).toHaveLength(2);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain('Pokok');
    expect(html).toContain('Baru');
    expect(html).not.toContain('<button');
  });
  it('disables the group while the form is busy',()=>{
    expect(renderToStaticMarkup(<StockChoice {...props} disabled/>)).toContain('disabled=""');
  });
});
