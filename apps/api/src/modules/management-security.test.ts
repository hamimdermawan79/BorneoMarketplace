import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

const mocks=vi.hoisted(()=>({
  query:vi.fn(), compare:vi.fn(), hash:vi.fn(), maintenanceConnect:vi.fn(),
  user:{id:'a1000000-0000-4000-8000-000000000001',role:'SUPERADMIN',organizationId:null,email:'admin@test.local'},
}));
vi.mock('../database/client.js',()=>({pool:{query:mocks.query},withTransaction:async(work:any)=>work({query:mocks.query})}));
vi.mock('../types.js',()=>({allow:()=>async(request:any)=>{request.user={...mocks.user};},authenticate:async(request:any)=>{request.user={...mocks.user};}}));
vi.mock('../config.js',()=>({config:{DATABASE_URL:'postgresql://runtime:password@127.0.0.1:5432/security_test'}}));
vi.mock('bcryptjs',()=>({default:{compare:mocks.compare,hash:mocks.hash}}));
vi.mock('pg',()=>({default:{Client:class{connect=mocks.maintenanceConnect;query=mocks.query;end=vi.fn();}}}));

import {catalogRoutes} from './catalog.js';
import {clusterRoutes} from './clusters.js';
import {managementRoutes} from './management.js';
import {confirmation,resetRoutes} from './reset.js';

const foreignId='a2000000-0000-4000-8000-000000000002';
const apps:ReturnType<typeof Fastify>[]=[];
async function appWith(routes:(app:ReturnType<typeof Fastify>)=>Promise<void>){
  const app=Fastify();apps.push(app);
  app.setErrorHandler((error,request,reply)=>reply.code(error instanceof ZodError?400:(error as {statusCode?:number}).statusCode||500).send({message:(error as Error).message}));
  await app.register(routes);return app;
}

beforeEach(()=>{vi.clearAllMocks();mocks.user.role='SUPERADMIN';mocks.query.mockResolvedValue({rows:[],rowCount:0});mocks.hash.mockResolvedValue('test-hash');});
afterEach(async()=>{await Promise.all(apps.splice(0).map(app=>app.close()));vi.unstubAllEnvs();});

describe('management API security regressions',()=>{
  it('does not attach an inaccessible private product and scopes the atomic insert',async()=>{
    mocks.user.role='ADMIN';
    const app=await appWith(catalogRoutes);
    const response=await app.inject({method:'POST',url:'/admin-products',payload:{templateId:foreignId,salePrice:1000}});
    expect(response.statusCode).toBe(404);
    const [sql,params]=mocks.query.mock.calls[0];
    expect(sql).toContain('owner_admin_user_id IS NULL OR owner_admin_user_id=$1');
    expect(sql).toContain('AND active');
    expect(params).toEqual([mocks.user.id,foreignId,1000]);
  });

  it('rejects stock values that would silently round before any database write',async()=>{
    const app=await appWith(catalogRoutes);
    const response=await app.inject({method:'POST',url:'/stock',payload:{adminProductId:foreignId,salePrice:1,quantity:0.0001}});
    expect(response.statusCode).toBe(400);expect(mocks.query).not.toHaveBeenCalled();
  });

  it('generates distinct partner credentials and does not audit their password',async()=>{
    mocks.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING id')?{rows:[{id:foreignId}],rowCount:1}:{rows:[],rowCount:0});
    const app=await appWith(clusterRoutes);
    const payload={name:'Dapur Baru',phone:'08123456789',address:'Desa Lumbang',gmapsUrl:'https://maps.app.goo.gl/abc'};
    const first=(await app.inject({method:'POST',url:'/partners',payload})).json();
    const second=(await app.inject({method:'POST',url:'/partners',payload})).json();
    expect(first.temporaryPassword.length).toBeGreaterThanOrEqual(32);
    expect(first.temporaryPassword).not.toBe(second.temporaryPassword);
    const audits=mocks.query.mock.calls.filter(([sql])=>sql.includes('INSERT INTO audit_logs'));
    expect(JSON.stringify(audits)).not.toContain(first.temporaryPassword);
  });

  it('rechecks a revoked superadmin after acquiring the role-management lock',async()=>{
    const app=await appWith(managementRoutes);
    const response=await app.inject({method:'PATCH',url:`/users/${foreignId}`,payload:{active:false}});
    expect(response.statusCode).toBe(401);
    expect(mocks.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
    expect(mocks.query.mock.calls.some(([sql])=>sql.startsWith('UPDATE users'))).toBe(false);
  });

  it('protects the last active superadmin within the serialized transaction',async()=>{
    mocks.query.mockImplementation(async(sql:string)=>{
      if(sql.includes("SELECT 1 FROM users WHERE id=$1 AND role='SUPERADMIN'"))return {rows:[{}],rowCount:1};
      if(sql.includes('SELECT role,active'))return {rows:[{role:'SUPERADMIN',active:true}],rowCount:1};
      if(sql.includes('count(*)'))return {rows:[{count:0}],rowCount:1};
      return {rows:[],rowCount:0};
    });
    const app=await appWith(managementRoutes);
    const response=await app.inject({method:'PATCH',url:`/users/${foreignId}`,payload:{role:'ADMIN'}});
    expect(response.statusCode).toBe(409);
    expect(mocks.query.mock.calls.some(([sql])=>sql.startsWith('UPDATE users'))).toBe(false);
  });
});

describe('destructive reset guard',()=>{
  beforeEach(()=>{vi.stubEnv('ALLOW_DATA_RESET','true');vi.stubEnv('DATA_RESET_DATABASE_URL','postgresql://owner:password@127.0.0.1:5432/security_test');vi.stubEnv('NODE_ENV','development');});
  it('always refuses production reset, even when explicitly enabled',async()=>{
    vi.stubEnv('NODE_ENV','production');const app=await appWith(resetRoutes);
    const response=await app.inject({method:'POST',url:'/management/reset',payload:{confirmation,password:'password123'}});
    expect(response.statusCode).toBe(403);expect(mocks.query).not.toHaveBeenCalled();expect(mocks.maintenanceConnect).not.toHaveBeenCalled();
  });
  it('refuses reset without an explicit maintenance connection',async()=>{
    vi.stubEnv('DATA_RESET_DATABASE_URL','');const app=await appWith(resetRoutes);
    const response=await app.inject({method:'POST',url:'/management/reset',payload:{confirmation,password:'password123'}});
    expect(response.statusCode).toBe(403);expect(mocks.maintenanceConnect).not.toHaveBeenCalled();
  });
  it('verifies the password before taking table locks or opening privileged access',async()=>{
    mocks.query.mockResolvedValue({rows:[{password_hash:'test-hash'}],rowCount:1});mocks.compare.mockResolvedValue(false);
    const app=await appWith(resetRoutes);
    const response=await app.inject({method:'POST',url:'/management/reset',payload:{confirmation,password:'wrong-password'}});
    expect(response.statusCode).toBe(403);expect(mocks.maintenanceConnect).not.toHaveBeenCalled();
    expect(mocks.query.mock.calls.some(([sql])=>/LOCK TABLE|DELETE FROM/.test(sql))).toBe(false);
  });
  it('rejects oversized bcrypt input before any database access',async()=>{
    const app=await appWith(resetRoutes);
    const response=await app.inject({method:'POST',url:'/management/reset',payload:{confirmation,password:'a'.repeat(200)}});
    expect(response.statusCode).toBe(400);expect(mocks.query).not.toHaveBeenCalled();expect(mocks.maintenanceConnect).not.toHaveBeenCalled();
  });
});
