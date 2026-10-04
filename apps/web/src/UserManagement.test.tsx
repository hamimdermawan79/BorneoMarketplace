import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('./api',()=>({api:vi.fn()}));
import {UserManagement} from './SuperadminPanel';
import {DeleteAccountDialog} from './DeleteAccountDialog';
const actor={id:'self',name:'Owner',username:'owner',email:null,role:'SUPERADMIN' as const,organizationId:null};
const account={id:'other',name:'Dapur Test',username:'dapur',email:null,role:'BUYER' as const,active:false,organizationId:'k',organization:'Dapur Test',phone:null,address:null,gmapsUrl:null,managerId:null,manager:null};
describe('inactive account deletion UI',()=>{
  it('offers deletion only for inactive accounts, not active accounts or self',()=>{
    const html=renderToStaticMarkup(<UserManagement currentUser={actor} users={[account,{...account,id:'active',active:true},{...account,id:'self',role:'SUPERADMIN'}]} admins={[]} reload={async()=>{}}/>);
    expect(html.match(/>Hapus akun</g)).toHaveLength(1);
  });
  it('explains preserved history and offers a safe cancel action',()=>{
    const html=renderToStaticMarkup(<DeleteAccountDialog name="Dapur Test" busy={false} error="" cancel={()=>{}} confirm={()=>{}}/>);
    expect(html).toContain('Histori transaksi tetap disimpan.');expect(html).toContain('tidak dapat diaktifkan kembali');expect(html).toContain('Batal');expect(html).toContain('aria-describedby');
  });
  it('prevents repeated confirmation while deletion is running',()=>{
    const html=renderToStaticMarkup(<DeleteAccountDialog name="Dapur Test" busy error="" cancel={()=>{}} confirm={()=>{}}/>);
    expect(html).toContain('Menghapus…');expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
});
