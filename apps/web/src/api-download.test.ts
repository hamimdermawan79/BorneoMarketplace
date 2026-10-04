import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {download} from './api';

describe('report downloads in the Android shell',()=>{
  const anchor={href:'',download:'',click:vi.fn(),remove:vi.fn()};
  const append=vi.fn(),create=vi.fn(()=> 'blob:report'),revoke=vi.fn();
  beforeEach(()=>{
    vi.useFakeTimers();anchor.href='';vi.clearAllMocks();
    vi.stubGlobal('localStorage',{getItem:()=> 'token'});
    vi.stubGlobal('sessionStorage',{getItem:()=>null});
    vi.stubGlobal('navigator',{userAgent:'Chrome BorneoAndroid/1.0'});
    vi.stubGlobal('document',{body:{append},createElement:()=>anchor});
    vi.stubGlobal('URL',{createObjectURL:create,revokeObjectURL:revoke});
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Blob(['report'],{type:'application/pdf'}))));
    vi.stubGlobal('FileReader',class {
      result='data:application/pdf;base64,cmVwb3J0';onload?:()=>void;
      readAsDataURL(){this.onload?.()}
    });
  });
  afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()});
  it('keeps authenticated fetch and uses a data URL for the native save dialog',async()=>{
    await download('/reports/pdf','report.pdf');
    expect(fetch).toHaveBeenCalledWith('/api/reports/pdf',{headers:{Authorization:'Bearer token'}});
    expect(anchor.href).toBe('data:application/pdf;base64,cmVwb3J0');
    expect(anchor.download).toBe('report.pdf');expect(anchor.click).toHaveBeenCalledOnce();
    expect(create).not.toHaveBeenCalled();
  });
  it('uses normal blob URLs in browsers and revokes after the download starts',async()=>{
    vi.stubGlobal('navigator',{userAgent:'Chrome'});
    await download('/reports/pdf','report.pdf');
    expect(anchor.href).toBe('blob:report');expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30000);expect(revoke).toHaveBeenCalledWith('blob:report');
  });
  it('does not download error responses',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('Forbidden',{status:403})));
    await expect(download('/reports/pdf','report.pdf')).rejects.toThrow('Ekspor gagal.');
    expect(anchor.click).not.toHaveBeenCalled();
  });
});
