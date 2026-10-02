import {describe,expect,it} from 'vitest';
import {resolveStockSource} from './stock-source.js';

describe('master product source policy',()=>{
  it('uses the configured source when the client omits it',()=>{
    expect(resolveStockSource(undefined,'COOPERATIVE')).toBe('COOPERATIVE');
    expect(resolveStockSource(undefined,'VENDOR')).toBe('VENDOR');
  });
  it('rejects an admin override in either direction',()=>{
    expect(()=>resolveStockSource('VENDOR','COOPERATIVE')).toThrow('superadmin');
    expect(()=>resolveStockSource('COOPERATIVE','VENDOR')).toThrow('superadmin');
  });
  it('allows matching master source and independent custom-product source',()=>{
    expect(resolveStockSource('VENDOR','VENDOR')).toBe('VENDOR');
    expect(resolveStockSource('COOPERATIVE','COOPERATIVE')).toBe('COOPERATIVE');
    expect(resolveStockSource('VENDOR')).toBe('VENDOR');
    expect(resolveStockSource(undefined)).toBe('COOPERATIVE');
  });
});
