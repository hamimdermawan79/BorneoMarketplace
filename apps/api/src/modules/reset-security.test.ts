import Fastify from 'fastify';
import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const mocks=vi.hoisted(()=>({query:vi.fn(),compare:vi.fn(),dump:vi.fn(),mkdir:vi.fn(),stat:vi.fn(),media:vi.fn(),connect:vi.fn()}));
vi.mock('../database/client.js',()=>({pool:{query:mocks.query}}));
vi.mock('../types.js',()=>({allow:()=>async(request:any)=>{request.user={id:'actor'};}}));
vi.mock('../config.js',()=>({config:{DATABASE_URL:'postgresql://runtime:pass@127.0.0.1/test_reset'}}));
vi.mock('bcryptjs',()=>({default:{compare:mocks.compare}}));
vi.mock('pg',()=>({default:{Client:class{connect=mocks.connect;query=mocks.query;end=async()=>{}}}}));
vi.mock('node:child_process',()=>({execFile:(...args:any[])=>mocks.dump(...args)}));
vi.mock('node:fs/promises',()=>({mkdir:mocks.mkdir,stat:mocks.stat,chmod:vi.fn(),realpath:async(path:string)=>path}));
vi.mock('../images/backup.js',()=>({backupPrivateProductImages:mocks.media}));
import {confirmation,resetRoutes} from './reset.js';
const apps:ReturnType<typeof Fastify>[]=[];
async function setup(){const app=Fastify();apps.push(app);app.setErrorHandler((e,_req,reply)=>reply.code((e as any).statusCode||500).send({message:(e as Error).message}));await app.register(resetRoutes);return app}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('NODE_ENV','production');vi.stubEnv('ALLOW_DATA_RESET','true');vi.stubEnv('DATA_RESET_DATABASE_URL','postgresql://cleanup:pass@127.0.0.1/test_reset');vi.stubEnv('DATA_RESET_BACKUP_DIR',join(tmpdir(),'borneo-cleanup-test-backups'));vi.stubEnv('PG_DUMP_PATH','pg_dump');mocks.query.mockResolvedValue({rows:[{password_hash:'hash'}],rowCount:1});mocks.compare.mockResolvedValue(true);mocks.stat.mockResolvedValue({size:200});mocks.dump.mockImplementation((...args:any[])=>args.at(-1)(null,'',''));mocks.mkdir.mockResolvedValue(undefined);mocks.media.mockResolvedValue(0)});
afterEach(async()=>{await Promise.all(apps.splice(0).map(app=>app.close()));vi.unstubAllEnvs()});
const deletes=()=>mocks.query.mock.calls.filter(([sql])=>sql.startsWith('DELETE FROM'));
describe('production cleanup backups',()=>{
  it('backs up database and media outside the release before any deletion',async()=>{const app=await setup();const response=await app.inject({method:'POST',url:'/management/reset',payload:{confirmation,password:'Secret123!'}});expect(response.statusCode,response.body).toBe(200);expect(deletes()).toHaveLength(14);const args=mocks.dump.mock.calls[0];expect(args[1][2]).toMatch(/borneo-cleanup-test-backups[\\/]before-reset-/);expect(mocks.media).toHaveBeenCalled();expect(mocks.media.mock.invocationCallOrder[0]).toBeLessThan(mocks.query.mock.invocationCallOrder[mocks.query.mock.calls.findIndex(([sql])=>sql.startsWith('DELETE FROM'))]);expect(mocks.query).toHaveBeenCalledWith('COMMIT');});
  it.each(['dump','media','directory','empty'])('aborts without deletion if %s backup fails',async kind=>{if(kind==='dump')mocks.dump.mockImplementation((...args:any[])=>args.at(-1)(Error('failed')));if(kind==='media')mocks.media.mockRejectedValue(Error('failed'));if(kind==='directory')mocks.mkdir.mockRejectedValue(Error('readonly'));if(kind==='empty')mocks.stat.mockResolvedValue({size:0});const app=await setup();const r=await app.inject({method:'POST',url:'/management/reset',payload:{confirmation,password:'Secret123!'}});expect(r.statusCode).toBe(503);expect(deletes()).toHaveLength(0);expect(mocks.query).toHaveBeenCalledWith('ROLLBACK');});
  it('refuses production reset without a configured private backup directory',async()=>{vi.stubEnv('DATA_RESET_BACKUP_DIR','');const app=await setup();expect((await app.inject({method:'POST',url:'/management/reset',payload:{confirmation,password:'Secret123!'}})).statusCode).toBe(503);expect(deletes()).toHaveLength(0);});
  it('rejects a different target database before connecting',async()=>{vi.stubEnv('DATA_RESET_DATABASE_URL','postgresql://cleanup:pass@127.0.0.1/another_db');const app=await setup();expect((await app.inject({method:'POST',url:'/management/reset',payload:{confirmation,password:'Secret123!'}})).statusCode).toBe(403);expect(mocks.connect).not.toHaveBeenCalled();});
});
