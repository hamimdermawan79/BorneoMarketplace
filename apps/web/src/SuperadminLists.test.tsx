import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('./api',()=>({api:vi.fn(),download:vi.fn()}));
import {ProductMaster,UserManagement} from './SuperadminPanel';
describe('superadmin list actions',()=>{
  it('retains self-account protection in the responsive user list',()=>{
    const user={id:'self',name:'Superadmin',username:'superadmin',email:null,role:'SUPERADMIN' as const,organizationId:'org',organization:'Borneo Marketplace',active:true,phone:null,address:null,gmapsUrl:null,managerId:null,manager:null};
    const html=renderToStaticMarkup(<UserManagement users={[user]} admins={[]} currentUser={user} reload={async()=>{}}/>);
    expect(html).toContain('users-management-table');expect(html).toContain('class="table-action" disabled=""');expect(html).toContain('Edit akun');
  });
  it('keeps stock-source control and separates the delete action',()=>{
    const template={id:'product',sku:'AP-001',name:'Ayam Potong',category:'Protein',image:null,orderUnit:'Potong',priceUnit:'kg',weighingRequired:true,estimatedKgPerUnit:.8,stockSource:'COOPERATIVE' as const,active:false};
    const html=renderToStaticMarkup(<ProductMaster templates={[template]} reload={async()=>{}}/>);
    expect(html).toContain('product-master-table');expect(html).toContain('Sumber Ayam Potong');expect(html).toContain('table-action table-action-danger');expect(html).toContain('Aktifkan');
  });
});
