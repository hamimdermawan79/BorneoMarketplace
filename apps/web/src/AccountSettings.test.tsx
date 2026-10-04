import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('./api',()=>({api:vi.fn()}));
import {AccountEditor,BuyerSettings,type ManagedAccount} from './AccountSettings';
const account:ManagedAccount={id:'test',name:'Dapur Melati',username:'melati',email:null,role:'BUYER',active:true,organization:'Dapur Melati',phone:'08123456789',address:'Sambas Kalimantan Barat',gmapsUrl:null,managerId:'admin-a'};
describe('account settings forms',()=>{
  it('allows admin to edit identity/kitchen but hides cluster reassignment',()=>{
    const html=renderToStaticMarkup(<AccountEditor account={account} onClose={()=>{}} onSaved={async()=>{}}/>);
    for(const name of ['fullName','username','email','phone','kitchenName','address','gmapsUrl','active','password'])expect(html).toContain(`name="${name}"`);
    expect(html).not.toContain('name="adminId"');expect(html).not.toContain('name="role"');
    expect(html).toContain('role="dialog"');expect(html).toContain('aria-modal="true"');
  });
  it('shows assignment only for the superadmin form',()=>{
    const html=renderToStaticMarkup(<AccountEditor account={account} superadmin admins={[{id:'admin-a',name:'Admin A',active:true}]} onClose={()=>{}} onSaved={async()=>{}}/>);
    expect(html).toContain('name="adminId"');expect(html).toContain('value="admin-a" selected=""');
    expect(html).toContain('Superadmin tidak perlu memasukkan password lama.');
  });
  it('does not edit cooperative-wide organization data when editing admin accounts',()=>{
    const html=renderToStaticMarkup(<AccountEditor account={{...account,role:'ADMIN'}} onClose={()=>{}} onSaved={async()=>{}}/>);
    expect(html).not.toContain('name="kitchenName"');expect(html).not.toContain('name="phone"');
  });
  it('keeps buyer identity read-only, with separate phone and password forms',()=>{
    const html=renderToStaticMarkup(<BuyerSettings user={{id:'buyer',name:'Buyer',username:'buyer',role:'BUYER',email:null,organizationId:'kitchen',phone:'08123456789'}} onLogout={()=>{}}/>);
    for(const name of ['phone','currentPassword','newPassword','confirmation'])expect(html).toContain(`name="${name}"`);
    for(const name of ['username','fullName','address','role','email'])expect(html).not.toContain(`name="${name}"`);
    expect(html.match(/<form/g)).toHaveLength(2);
    expect(html).toContain('class="logout-danger"');
    expect(html).toContain('Keluar dari akun');
  });
});
