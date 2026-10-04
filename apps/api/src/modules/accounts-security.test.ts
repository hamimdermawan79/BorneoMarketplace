import Fastify from 'fastify';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {ZodError} from 'zod';
const mocks=vi.hoisted(()=>({query:vi.fn(),compare:vi.fn(),hash:vi.fn(),role:'SUPERADMIN',active:true,targetActive:false,targetExists:true,claim:'current'}));
vi.mock('../database/client.js',()=>({pool:{query:mocks.query},withTransaction:async(work:any)=>work({query:mocks.query})}));
vi.mock('../types.js',()=>({credentialVersion:()=> 'current',allow:(...roles:string[])=>async(request:any,reply:any)=>{request.user={id:actorId,role:mocks.role};if(!roles.includes(mocks.role))return reply.code(403).send({message:'Forbidden'});}}));
vi.mock('bcryptjs',()=>({default:{compare:mocks.compare,hash:mocks.hash}}));
import {accountRoutes} from './accounts.js';
const actorId='a1000000-0000-4000-8000-000000000001',targetId='a2000000-0000-4000-8000-000000000002';
const apps:ReturnType<typeof Fastify>[]=[];
async function setup(){const app=Fastify();apps.push(app);app.decorateRequest('jwtVerify',async()=>({credentialVersion:mocks.claim}) as any);app.setErrorHandler((e,_req,reply)=>reply.code(e instanceof ZodError?400:(e as any).statusCode||500).send({message:(e as Error).message}));await app.register(accountRoutes);return app}
beforeEach(()=>{vi.clearAllMocks();mocks.role='SUPERADMIN';mocks.active=true;mocks.targetActive=false;mocks.targetExists=true;mocks.claim='current';mocks.compare.mockResolvedValue(true);mocks.hash.mockResolvedValue('new-hash');mocks.query.mockImplementation(async(sql:string)=>{
  if(sql.startsWith('SELECT role,active,password_hash'))return {rows:[{role:mocks.role,active:mocks.active,password_hash:'old-hash'}],rowCount:1};
  if(sql.startsWith('SELECT id,role,active'))return {rows:mocks.targetExists?[{id:targetId,role:'BUYER',active:mocks.targetActive,organization_id:targetId}]:[],rowCount:mocks.targetExists?1:0};
  return {rows:[{id:targetId}],rowCount:1};
})});
afterEach(async()=>{await Promise.all(apps.splice(0).map(app=>app.close()))});
describe('superadmin account lifecycle',()=>{
  it('resets passwords without the actor old password and never audits passwords',async()=>{const app=await setup();const r=await app.inject({method:'PATCH',url:`/accounts/${targetId}`,payload:{password:'NewSecure123!'}});expect(r.statusCode).toBe(200);expect(mocks.compare).not.toHaveBeenCalled();expect(mocks.hash).toHaveBeenCalledWith('NewSecure123!',12);const audit=mocks.query.mock.calls.find(([sql])=>sql.includes('INSERT INTO audit_logs'));expect(JSON.stringify(audit)).not.toContain('NewSecure123!');expect(JSON.stringify(audit)).toContain('passwordChanged');});
  it('still requires the administrator password',async()=>{mocks.role='ADMIN';const app=await setup();const r=await app.inject({method:'PATCH',url:`/accounts/${targetId}`,payload:{password:'NewSecure123!'}});expect(r.statusCode).toBe(400);expect(mocks.hash).not.toHaveBeenCalled();});
  it('rejects a wrong administrator password',async()=>{mocks.role='ADMIN';mocks.compare.mockResolvedValue(false);const app=await setup();const r=await app.inject({method:'PATCH',url:`/accounts/${targetId}`,payload:{password:'NewSecure123!',currentPassword:'WrongOld123!'}});expect(r.statusCode).toBe(403);expect(mocks.hash).not.toHaveBeenCalled();});
  it.each(['ADMIN','BUYER'])('denies account deletion to %s',async role=>{mocks.role=role;const app=await setup();expect((await app.inject({method:'DELETE',url:`/accounts/${targetId}`})).statusCode).toBe(403);expect(mocks.query).not.toHaveBeenCalled();});
  it('refuses active accounts and the signed-in account',async()=>{const app=await setup();mocks.targetActive=true;expect((await app.inject({method:'DELETE',url:`/accounts/${targetId}`})).statusCode).toBe(409);expect((await app.inject({method:'DELETE',url:`/accounts/${actorId}`})).statusCode).toBe(409);expect(mocks.query.mock.calls.some(([sql])=>sql.startsWith('UPDATE users'))).toBe(false);});
  it.each(['inactive','stale'])('rechecks %s actor after locking before deletion',async kind=>{if(kind==='inactive')mocks.active=false;else mocks.claim='stale';const app=await setup();expect((await app.inject({method:'DELETE',url:`/accounts/${targetId}`})).statusCode).toBe(401);expect(mocks.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');expect(mocks.query.mock.calls.some(([sql])=>sql.startsWith('UPDATE users'))).toBe(false);});
  it('archives only inactive accounts, preserving all historical references',async()=>{const app=await setup();expect((await app.inject({method:'DELETE',url:`/accounts/${targetId}`})).statusCode).toBe(200);expect(mocks.query).toHaveBeenCalledWith('UPDATE users SET deleted_at=now() WHERE id=$1 AND NOT active',[targetId]);expect(mocks.query.mock.calls.some(([sql])=>sql.startsWith('DELETE FROM'))).toBe(false);expect(mocks.query.mock.calls.find(([sql])=>sql.includes('INSERT INTO audit_logs'))![1]).toContain(targetId);});
  it('does not allow editing an already deleted account',async()=>{mocks.targetExists=false;const app=await setup();expect((await app.inject({method:'PATCH',url:`/accounts/${targetId}`,payload:{active:true}})).statusCode).toBe(404);expect(mocks.query.mock.calls.find(([sql])=>sql.startsWith('SELECT id,role,active'))![0]).toContain('deleted_at IS NULL');});
  it('hides deleted accounts from management lists',async()=>{const app=await setup();expect((await app.inject({method:'GET',url:'/accounts'})).statusCode).toBe(200);expect(mocks.query.mock.calls[0][0]).toContain('u.deleted_at IS NULL');});
});
