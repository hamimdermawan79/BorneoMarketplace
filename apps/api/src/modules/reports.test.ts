import Fastify from 'fastify';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({query:vi.fn(),role:'SUPERADMIN'}));
vi.mock('../database/client.js',()=>({pool:{query:mocks.query}}));
vi.mock('../types.js',()=>({allow:(...roles:string[])=>async(request:any,reply:any)=>{request.user={id:'actor',role:mocks.role};if(!roles.includes(mocks.role))return reply.code(403).send({message:'Forbidden'});}}));
import {reportRoutes} from './reports.js';
const row={order_no:'INV-001',needed_date:'2026-10-10',kitchen:'Dapur',admin:'Admin',product_name:'Beras',ordered_quantity:10,order_unit:'kg',actual_weight_kg:null,unit_price:15000,total:150000,sources:'COOPERATIVE, VENDOR',allocations:[
  {source:'COOPERATIVE',vendor_id:null,vendor_name:null,quantity:6,cost_price:10000},
  {source:'VENDOR',vendor_id:'a',vendor_name:'Vendor <A>',quantity:4,cost_price:12000},
]};
const apps:ReturnType<typeof Fastify>[]=[];
async function setup(){const app=Fastify();apps.push(app);await app.register(reportRoutes);return app}
beforeEach(()=>{vi.clearAllMocks();mocks.role='SUPERADMIN';mocks.query.mockResolvedValue({rows:[row]})});
afterEach(async()=>{await Promise.all(apps.splice(0).map(app=>app.close()))});
describe('source-grouped report routes',()=>{
  it('returns actual allocation quantities with vendor identity, not duplicate item totals',async()=>{
    const app=await setup();const response=await app.inject('/reports/sales?from=2026-10-01&to=2026-10-31');
    expect(response.statusCode).toBe(200);
    const rows=response.json();expect(rows.map((r:any)=>r.total)).toEqual([90000,60000]);
    expect(rows.map((r:any)=>r.source_label)).toEqual(['Barang Koperasi','Vendor <A>']);
    expect(rows[0]).not.toHaveProperty('allocations');
    const [sql,params]=mocks.query.mock.calls[0];expect(sql).toContain('LEFT JOIN vendors v ON v.id=a.vendor_id');
    expect(sql).toContain('COALESCE(a.actual_quantity,a.reserved_quantity)');
    expect(params).toEqual(['2026-10-01','2026-10-31']);
  });
  it('keeps administrator and kitchen filters parameterized',async()=>{
    mocks.role='ADMIN';const app=await setup();await app.inject('/reports/sales?kitchenId=a1000000-0000-4000-8000-000000000001');
    const [sql,params]=mocks.query.mock.calls[0];expect(sql).toContain('o.admin_user_id=$1');expect(sql).toContain('o.kitchen_id=$2');
    expect(params).toEqual(['actor','a1000000-0000-4000-8000-000000000001']);
  });
  it('denies reports to buyers',async()=>{mocks.role='BUYER';const app=await setup();expect((await app.inject('/reports/sales')).statusCode).toBe(403);expect(mocks.query).not.toHaveBeenCalled()});
  it('exports merged bold separators and escaped vendor names in Excel',async()=>{
    const app=await setup();const response=await app.inject('/reports/sales.xls');expect(response.statusCode).toBe(200);
    expect(response.body).toContain('ss:ID="Group"><Font ss:Bold="1"');
    expect(response.body.match(/ss:MergeAcross="12"/g)).toHaveLength(2);
    expect(response.body).toContain('Vendor &lt;A&gt;');expect(response.body).not.toContain('Vendor <A>');
    expect(response.body).toContain('>90000</Data>');expect(response.body).toContain('>60000</Data>');
  });
  it('limits the expanded report as well as the original item count',async()=>{
    mocks.query.mockResolvedValue({rows:Array.from({length:5001},()=>row)});
    const app=await setup();const r=await app.inject('/reports/sales');expect(r.statusCode).toBe(413);
  });
});
