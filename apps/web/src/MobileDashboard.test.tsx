import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('./api',()=>({api:vi.fn(),session:{},download:vi.fn()}));
import {AdminOrders,Shell} from './App';
import {ExecutiveDashboard} from './SuperadminPanel';
import type {User} from './api';
const user:User={id:'preview',name:'Admin Mentawa',username:'preview',email:null,role:'ADMIN',organizationId:null};
describe('mobile dashboard structure',()=>{
  it('groups six status filters in the padded order list',()=>{
    const html=renderToStaticMarkup(<AdminOrders orders={[]} reload={async()=>{}}/>);
    expect(html).toContain('orders-list-panel');
    expect(html.match(/aria-pressed=/g)).toHaveLength(6);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain('Tidak ada pesanan pada status ini.');
  });
  it('groups admin activity and keeps metrics informational without shortcuts',()=>{
    const html=renderToStaticMarkup(<Shell user={user} onLogout={()=>{}}/>);
    expect(html).toContain('mobile-dashboard-name">Admin Mentawa');
    expect(html).toContain('dashboard-content-sheet');
    expect(html).toContain('Stok kritis');
    expect(html).toContain('Mitra dapur');
    expect(html.match(/<article class="metric">/g)).toHaveLength(4);
    expect(html).not.toContain('metric-shortcut');
  });
  it('keeps the buyer brand, dashboard metrics and grouped activity',()=>{
    const html=renderToStaticMarkup(<Shell user={{...user,role:'BUYER',name:'Dapur Melati',organization:'Dapur Melati'}} onLogout={()=>{}}/>);
    expect(html).toContain('mobile-app-brand');
    expect(html).toContain('Dapur Melati');
    expect(html).toContain('buyer-metrics');
    expect(html).toContain('dashboard-content-sheet');
    expect(html).not.toContain('metric-shortcut');
  });
  it('uses the shared KPI and content layers for superadmin',()=>{
    const html=renderToStaticMarkup(<ExecutiveDashboard overview={{summary:{activeAdmins:0,activeKitchens:0,activeOrders:0,completedThisMonth:0,salesThisMonth:0,unassignedKitchens:0},statuses:[],admins:[]}} auditLogs={[]}/>);
    expect(html).toContain('superadmin-dashboard-home');
    expect(html).toContain('dashboard-content-sheet');
    expect(html.match(/class="executive-metric"/g)).toHaveLength(4);
    expect(html).toContain('Kinerja admin koperasi');
    expect(html).toContain('Status operasional');
  });
  it.each(['ADMIN','BUYER','SUPERADMIN'] as const)('keeps the shared brand and navigation for %s',role=>{
    const html=renderToStaticMarkup(<Shell user={{...user,role}} onLogout={()=>{}}/>);
    expect(html).toContain(`role-${role.toLowerCase()}`);
    expect(html).toContain('data-page="dashboard"');
    expect(html).toContain('mobile-app-brand');
    expect(html).toContain('buyer-bottom-nav');
    expect(html.match(/class="nav-glass-indicator"/g)).toHaveLength(1);
    expect(html).toContain('style="--nav-index:0"');
    expect(html).toContain('class="logout"');
    expect(html).toContain('Keluar</button>');
  });
});
