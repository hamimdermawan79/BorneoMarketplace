import Fastify from 'fastify';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {ZodError} from 'zod';
const mocks=vi.hoisted(()=>({query:vi.fn(),user:{id:'a1000000-0000-4000-8000-000000000001',role:'ADMIN'}}));
vi.mock('../database/client.js',()=>({pool:{query:mocks.query},withTransaction:async(work:any)=>work({query:mocks.query})}));
vi.mock('../types.js',()=>({allow:(...roles:string[])=>async(request:any)=>{if(!roles.includes(mocks.user.role))throw Object.assign(new Error('Tidak diizinkan'),{statusCode:403});request.user={...mocks.user}}}));
import {stockEditInput,stockDelta,stockManagementRoutes} from './stock-management.js';
const productId='a2000000-0000-4000-8000-000000000002';const batchId='a3000000-0000-4000-8000-000000000003';
const apps:ReturnType<typeof Fastify>[]=[];
async function appWith(){const app=Fastify();apps.push(app);app.setErrorHandler((error,_request,reply)=>reply.code(error instanceof ZodError?400:(error as any).statusCode||500).send({message:(error as Error).message}));await app.register(stockManagementRoutes);return app}
const payload={salePrice:12000,expectedSalePrice:10000,adjustments:[{batchId,quantity:8,expectedQuantity:10}]};
beforeEach(()=>{vi.clearAllMocks();mocks.user.role='ADMIN';mocks.query.mockResolvedValue({rows:[],rowCount:0})});
afterEach(async()=>{await Promise.all(apps.splice(0).map(app=>app.close()))});
const setupOwn=()=>mocks.query.mockImplementation(async(sql:string)=>{
  if(sql.includes('FOR UPDATE OF ap'))return {rows:[{id:productId,salePrice:'10000.00'}],rowCount:1};
  if(sql.includes('FROM inventory_batches WHERE'))return {rows:[{id:batchId,available:'10.000',initial:'20.000'}],rowCount:1};
  return {rows:[],rowCount:0};
});
describe('stock correction boundary',()=>{
  it('accepts zero available stock and computes exact millesimal deltas',()=>{
    expect(stockEditInput.parse({...payload,adjustments:[{batchId,quantity:'0',expectedQuantity:'10'}]}).adjustments[0].quantity).toBe(0);
    expect(stockDelta(.3,.1)).toBe(-.2);
  });
  it.each([{...payload,adminId:productId},{...payload,templateId:productId},{...payload,quantityReserved:0},{...payload,adjustments:[payload.adjustments[0],payload.adjustments[0]]},{...payload,adjustments:[{batchId,quantity:-1,expectedQuantity:10}]},{...payload,adjustments:[{batchId,quantity:.0001,expectedQuantity:10}]},{...payload,adjustments:[{batchId,quantity:'',expectedQuantity:10}]}])('rejects privileged, duplicate or malformed fields: %j',input=>{
    expect(stockEditInput.safeParse(input).success).toBe(false);
  });
  it.each(['BUYER','SUPERADMIN'])('does not allow %s to edit admin stock',async role=>{
    mocks.user.role=role;const app=await appWith();expect((await app.inject({method:'PATCH',url:`/admin-products/${productId}/stock`,payload})).statusCode).toBe(403);expect(mocks.query).not.toHaveBeenCalled();
  });
  it('does not expose a foreign product or its batches',async()=>{
    const app=await appWith();expect((await app.inject({method:'GET',url:`/admin-products/${productId}/stock`})).statusCode).toBe(404);
    expect(mocks.query).toHaveBeenCalledTimes(1);expect(mocks.query.mock.calls[0][0]).toContain('ap.admin_user_id=$2');expect(mocks.query.mock.calls[0][1]).toEqual([productId,mocks.user.id]);
  });
  it('rejects corrections for a product owned by another admin',async()=>{
    const app=await appWith();expect((await app.inject({method:'PATCH',url:`/admin-products/${productId}/stock`,payload})).statusCode).toBe(404);
    expect(mocks.query.mock.calls[0][0]).toContain('ap.admin_user_id=$2');expect(mocks.query.mock.calls.some(([sql])=>sql.startsWith('UPDATE'))).toBe(false);
  });
  it('rejects a foreign batch even when the product belongs to the actor',async()=>{
    setupOwn();mocks.query.mockImplementationOnce(async()=>({rows:[{id:productId,salePrice:10000}],rowCount:1}));mocks.query.mockImplementationOnce(async()=>({rows:[],rowCount:0}));
    const app=await appWith();expect((await app.inject({method:'PATCH',url:`/admin-products/${productId}/stock`,payload})).statusCode).toBe(404);expect(mocks.query.mock.calls.some(([sql])=>sql.startsWith('UPDATE'))).toBe(false);
  });
  it('rejects stale stock or prices before writing',async()=>{
    setupOwn();const app=await appWith();expect((await app.inject({method:'PATCH',url:`/admin-products/${productId}/stock`,payload:{...payload,adjustments:[{batchId,quantity:8,expectedQuantity:11}]}})).statusCode).toBe(409);
    expect((await app.inject({method:'PATCH',url:`/admin-products/${productId}/stock`,payload:{...payload,expectedSalePrice:9000}})).statusCode).toBe(409);expect(mocks.query.mock.calls.some(([sql])=>sql.startsWith('UPDATE'))).toBe(false);
  });
  it('updates only free stock, records its delta, and preserves historical order prices',async()=>{
    setupOwn();const app=await appWith();expect((await app.inject({method:'PATCH',url:`/admin-products/${productId}/stock`,payload})).statusCode).toBe(200);
    const stock=mocks.query.mock.calls.find(([sql])=>sql.startsWith('UPDATE inventory_batches'))!;
    expect(stock[0]).not.toContain('quantity_reserved=');expect(stock[1]).toEqual([8,-2,batchId,productId]);
    const movement=mocks.query.mock.calls.find(([sql])=>sql.includes("'ADJUSTMENT'"))!;expect(movement[1][1]).toBe(-2);
    expect(mocks.query.mock.calls.some(([sql])=>sql.includes('INSERT INTO audit_logs'))).toBe(true);expect(mocks.query.mock.calls.some(([sql])=>/UPDATE order_items|UPDATE product_templates/.test(sql))).toBe(false);
  });
  it('refuses a correction that would overflow the stored batch quantity',async()=>{
    setupOwn();mocks.query.mockImplementationOnce(async()=>({rows:[{id:productId,salePrice:10000}],rowCount:1}));mocks.query.mockImplementationOnce(async()=>({rows:[{id:batchId,available:10,initial:99_999_999_999.999}],rowCount:1}));
    const app=await appWith();expect((await app.inject({method:'PATCH',url:`/admin-products/${productId}/stock`,payload:{...payload,adjustments:[{batchId,quantity:11,expectedQuantity:10}]}})).statusCode).toBe(400);expect(mocks.query.mock.calls.some(([sql])=>sql.startsWith('UPDATE'))).toBe(false);
  });
  it('allows price-only edits without touching inventory or existing orders',async()=>{
    setupOwn();const app=await appWith();expect((await app.inject({method:'PATCH',url:`/admin-products/${productId}/stock`,payload:{...payload,adjustments:[]}})).statusCode).toBe(200);
    expect(mocks.query.mock.calls.some(([sql])=>sql.startsWith('UPDATE admin_products'))).toBe(true);expect(mocks.query.mock.calls.some(([sql])=>sql.startsWith('UPDATE inventory_batches'))).toBe(false);
  });
});
