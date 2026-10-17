import Fastify from 'fastify';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {ZodError} from 'zod';
const fixtures=vi.hoisted(()=>({query:vi.fn(),user:{id:'a1000000-0000-4000-8000-000000000001',role:'ADMIN',organizationId:'b1000000-0000-4000-8000-000000000001'}}));
vi.mock('../database/client.js',()=>({pool:{query:fixtures.query},withTransaction:async(work:any)=>work({query:fixtures.query})}));
vi.mock('../types.js',()=>({authenticate:async(request:any)=>{request.user={...fixtures.user}},allow:(...roles:string[])=>async(request:any)=>{request.user={...fixtures.user};if(!roles.includes(fixtures.user.role))throw Object.assign(new Error('Akses ditolak'),{statusCode:403});}}));
import {orderRoutes} from './orders.js';
const allocation='c1000000-0000-4000-8000-000000000001';
const item='d1000000-0000-4000-8000-000000000001';
const order='e1000000-0000-4000-8000-000000000001';
const apps:ReturnType<typeof Fastify>[]=[];
async function server(){const app=Fastify();apps.push(app);app.setErrorHandler((error,_request,reply)=>reply.code(error instanceof ZodError?400:(error as any).statusCode||500).send({message:(error as Error).message}));await app.register(orderRoutes);return app;}
beforeEach(()=>{vi.clearAllMocks();fixtures.user.role='ADMIN';fixtures.query.mockResolvedValue({rows:[],rowCount:0});});
afterEach(async()=>{await Promise.all(apps.splice(0).map(app=>app.close()));});

describe('persisted order checklist and scoped order detail',()=>{
  it.each(['SUBMITTED','PREPARING'])('saves a marker without changing %s status or status history',async status=>{
    fixtures.query.mockResolvedValueOnce({rows:[{item_id:item,order_id:order,status}],rowCount:1});
    const app=await server();const response=await app.inject({method:'PATCH',url:`/allocations/${allocation}/prepared`,payload:{prepared:true}});
    expect(response.statusCode).toBe(200);
    const sql=fixtures.query.mock.calls.map(([sql])=>sql).join('\n');
    expect(sql).toContain('FOR UPDATE OF o');expect(sql).toContain('o.admin_user_id=$2');
    expect(sql).toContain('UPDATE order_item_allocations SET prepared');expect(sql).toContain('UPDATE order_items SET prepared=NOT EXISTS');
    expect(sql).not.toMatch(/UPDATE orders SET status|INSERT INTO order_status_history/);
    expect(fixtures.query.mock.calls[1][1]).toEqual([true,allocation]);
  });
  it('rejects an allocation owned by another admin before any write',async()=>{
    const response=await (await server()).inject({method:'PATCH',url:`/allocations/${allocation}/prepared`,payload:{prepared:false}});
    expect(response.statusCode).toBe(404);expect(fixtures.query).toHaveBeenCalledTimes(1);
    expect(fixtures.query.mock.calls[0][1]).toEqual([allocation,fixtures.user.id]);
  });
  it.each(['SHIPPED','AWAITING_KITCHEN','COMPLETED','CANCELLED'])('does not alter a checklist after %s',async status=>{
    fixtures.query.mockResolvedValueOnce({rows:[{item_id:item,order_id:order,status}],rowCount:1});
    const response=await (await server()).inject({method:'PATCH',url:`/allocations/${allocation}/prepared`,payload:{prepared:true}});
    expect(response.statusCode).toBe(409);expect(fixtures.query).toHaveBeenCalledTimes(1);
  });
  it('keeps checklist edits admin-only',async()=>{
    fixtures.user.role='BUYER';const response=await (await server()).inject({method:'PATCH',url:`/allocations/${allocation}/prepared`,payload:{prepared:true}});
    expect(response.statusCode).toBe(403);expect(fixtures.query).not.toHaveBeenCalled();
  });
  it.each(['ADMIN','BUYER','SUPERADMIN'])('fetches just one order with the existing %s scope',async role=>{
    fixtures.user.role=role;fixtures.query.mockResolvedValueOnce({rows:[{id:order,status:'SHIPPED',items:[]}],rowCount:1});
    const response=await (await server()).inject({method:'GET',url:`/orders/${order}`});expect(response.statusCode).toBe(200);expect(response.json().id).toBe(order);
    const [sql,params]=fixtures.query.mock.calls[0];
    expect(sql).toContain(role==='SUPERADMIN'?'WHERE o.id=$1':'AND o.id=$2');
    if(role==='ADMIN'){expect(sql).toContain('WHERE o.admin_user_id=$1');expect(params).toEqual([fixtures.user.id,order]);}
    if(role==='BUYER'){expect(sql).toContain('WHERE o.kitchen_id=$1');expect(params).toEqual([fixtures.user.organizationId,order]);}
    if(role==='SUPERADMIN')expect(params).toEqual([order]);
  });
  it('returns 404 for an unavailable order and validates IDs before reading',async()=>{
    const app=await server();expect((await app.inject({method:'GET',url:`/orders/${order}`})).statusCode).toBe(404);
    fixtures.query.mockClear();expect((await app.inject({method:'GET',url:'/orders/not-a-uuid'})).statusCode).toBe(400);expect(fixtures.query).not.toHaveBeenCalled();
  });
  it('returns confirmed status and final total without fetching the entire order list',async()=>{
    fixtures.query.mockImplementation(async(sql:string)=>({rows:sql.startsWith('SELECT o.*')?[{id:order,status:'SUBMITTED'}]:sql.includes('RETURNING id,status')?[{id:order,status:'PREPARING',finalTotal:null}]:[],rowCount:1}));
    const response=await (await server()).inject({method:'PATCH',url:`/orders/${order}/status`,payload:{status:'PREPARING'}});
    expect(response.statusCode).toBe(200);expect(response.json()).toEqual({success:true,id:order,status:'PREPARING',finalTotal:null});
    expect(fixtures.query.mock.calls.map(([sql])=>sql).join('\n')).not.toContain('json_agg');
  });
  it('still refuses shipping when server-side checklist or weight validation fails',async()=>{
    fixtures.query.mockResolvedValueOnce({rows:[{id:order,status:'PREPARING'}],rowCount:1}).mockResolvedValueOnce({rows:[{count:1}],rowCount:1});
    const response=await (await server()).inject({method:'PATCH',url:`/orders/${order}/status`,payload:{status:'SHIPPED'}});
    expect(response.statusCode).toBe(409);expect(fixtures.query).toHaveBeenCalledTimes(2);
    expect(fixtures.query.mock.calls[1][0]).toContain('i.actual_weight_kg IS NULL');
    expect(fixtures.query.mock.calls[1][0]).toContain('NOT a.prepared');
  });
});
