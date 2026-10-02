import {describe,expect,it,vi} from 'vitest';
// Schema-only tests must not load production database configuration.
vi.mock('../database/client.js',()=>({pool:{query:vi.fn()},withTransaction:vi.fn()}));
vi.mock('../types.js',()=>({allow:vi.fn(),credentialVersion:vi.fn()}));
import {accountUpdateInput,selfUpdateInput} from './accounts.js';

describe('account edit input boundary',()=>{
  it('permits normalized identity and optional contact changes',()=>{
    expect(accountUpdateInput.parse({username:'Dapur.Baru',email:'',kitchen:{gmapsUrl:''}})).toEqual({username:'dapur.baru',email:null,kitchen:{gmapsUrl:null}});
  });
  it.each([{role:'SUPERADMIN'},{organizationId:'fake'},{credentialVersion:'fake'},{password_hash:'fake'},{}])('rejects unknown privileges and empty updates: %j',payload=>{
    expect(accountUpdateInput.safeParse(payload).success).toBe(false);
  });
  it('requires actor verification for password resets',()=>{
    expect(accountUpdateInput.safeParse({password:'SecureNew123!'}).success).toBe(false);
    expect(accountUpdateInput.safeParse({password:'SecureNew123!',currentPassword:'SecureOld123!'}).success).toBe(true);
  });
  it.each([{phone:'08123456789',fullName:'Other'},{username:'another'},{active:false},{role:'ADMIN'},{kitchen:{name:'Other'}},{id:'other'},{}])('limits self-service to phone/password: %j',payload=>{
    expect(selfUpdateInput.safeParse(payload).success).toBe(false);
  });
  it('requires the old password and rejects malformed phone numbers',()=>{
    expect(selfUpdateInput.safeParse({phone:'https://example.com'}).success).toBe(false);
    expect(selfUpdateInput.safeParse({newPassword:'SecureNew123!'}).success).toBe(false);
    expect(selfUpdateInput.safeParse({phone:'+62 812-345-678',currentPassword:'SecureOld123!',newPassword:'SecureNew123!'}).success).toBe(true);
  });
});
