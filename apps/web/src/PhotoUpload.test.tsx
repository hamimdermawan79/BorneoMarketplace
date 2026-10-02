import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('./product-images',()=>({productImageAccept:'.png,.jpg,.jpeg,.webp,.heic'}));
import {PhotoUpload} from './PhotoUpload';

describe('PhotoUpload',()=>{
  const props={value:'',busy:false,onSelect:vi.fn(),onClear:vi.fn()};
  it('uses a hidden native input and a non-submit picker button',()=>{
    const html=renderToStaticMarkup(<PhotoUpload {...props}/>);
    expect(html).toContain('type="file"');
    expect(html).toContain('hidden=""');
    expect(html).toContain('type="button"');
    expect(html).toContain('Pilih foto');
    expect(html).not.toContain('Hapus foto');
    expect(html).toContain('8 MB');
    expect(html).toContain('<strong>Foto produk</strong>');
    expect(html).not.toContain('opsional');
    expect(html).not.toContain('photo-upload-preview');
  });
  it('shows a preview and replace/remove actions for an existing photo',()=>{
    const html=renderToStaticMarkup(<PhotoUpload {...props} value="data:image/webp;base64,test"/>);
    expect(html).toContain('alt="Pratinjau foto produk"');
    expect(html).toContain('Ganti foto');
    expect(html).toContain('Hapus foto');
  });
  it('supports a centered layout without changing upload controls',()=>{
    const html=renderToStaticMarkup(<PhotoUpload {...props} centered/>);
    expect(html).toContain('photo-upload photo-upload-centered');
    expect(html).toContain('Pilih foto');
  });
  it.each([{busy:true},{disabled:true}])('disables file selection during processing or saving: %j',state=>{
    const html=renderToStaticMarkup(<PhotoUpload {...props} {...state}/>);
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    if(state.busy)expect(html).toContain('Mengubah foto ke WebP');
  });
});
