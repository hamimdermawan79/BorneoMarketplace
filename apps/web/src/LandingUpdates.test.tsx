import {beforeEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const state=vi.hoisted(()=>({values:[] as unknown[]}));
vi.mock('react',async()=>({...await vi.importActual<typeof import('react')>('react'),useState:()=>[state.values.shift(),vi.fn()],useEffect:()=>{}}));
vi.mock('./api',()=>({api:vi.fn()}));
import {LandingUpdates} from './LandingUpdates';
const entry=(id:string)=>({id,headline:`Judul ${id}`,thumbnail:'https://example.com/image.webp',destination:`https://example.com/${id}`,active:true,createdAt:'2026-10-03',updatedAt:'2026-10-03'});
beforeEach(()=>{state.values=[]});
describe('public landing content',()=>{
  it('renders both news entries in the carousel, list and pagination',()=>{
    state.values=[{news:[entry('news-new'),entry('news-old')],prices:[]},false,'',0];
    const html=renderToStaticMarkup(<LandingUpdates/>);
    expect(html.match(/class="news-item"/g)).toHaveLength(2);
    expect(html).toContain('2 dari 2');
    const list=html.split('class="news-headline-list"')[1];
    expect(list).toContain('Judul news-new');expect(list).toContain('Judul news-old');
    expect(html).toContain('Berita 2: Judul news-old');
  });
  it('shows only the first three price documents while leaving news intact',()=>{
    state.values=[{news:[entry('news-new'),entry('news-old')],prices:[1,2,3,4].map(n=>entry(`price-${n}`))},false,'',0];
    const html=renderToStaticMarkup(<LandingUpdates/>);
    expect(html.match(/class="official-document"/g)).toHaveLength(3);
    for(const n of [1,2,3])expect(html).toContain(`Judul price-${n}`);
    expect(html).not.toContain('Judul price-4');
    expect(html.match(/class="news-item"/g)).toHaveLength(2);
  });
});
