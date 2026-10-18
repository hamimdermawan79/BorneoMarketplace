import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Toast} from './Toast';

describe('inventory notification',()=>{
  it('does not render an empty notification',()=>{
    expect(renderToStaticMarkup(<Toast message="" onDismiss={()=>{}}/>)).toBe('');
  });
  it('announces the message without moving keyboard focus and provides dismissal',()=>{
    const html=renderToStaticMarkup(<Toast message="Produk berhasil dihapus dari katalog Anda." onDismiss={()=>{}}/>);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Tutup notifikasi');
    expect(html).toContain('Produk berhasil dihapus dari katalog Anda.');
    expect(html).not.toContain('autofocus');
  });
});
