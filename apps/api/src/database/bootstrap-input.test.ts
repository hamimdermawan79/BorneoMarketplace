import {describe,expect,it} from 'vitest';
import {parseBootstrapCredentials} from './bootstrap-input.js';

const password='Fixture-Only-Unique-Password-42!';
describe('production bootstrap credentials',()=>{
  it('accepts username-only setup without a demo email',()=>{
    expect(parseBootstrapCredentials({BOOTSTRAP_USERNAME:' BorneoAdminSbs ',BOOTSTRAP_PASSWORD:password})).toEqual({username:'borneoadminsbs',email:null,password});
  });
  it('keeps email-only setup compatible',()=>{
    expect(parseBootstrapCredentials({BOOTSTRAP_EMAIL:' Admin@Example.com ',BOOTSTRAP_PASSWORD:password})).toEqual({username:null,email:'admin@example.com',password});
  });
  it('allows both username and optional email',()=>{
    expect(parseBootstrapCredentials({BOOTSTRAP_USERNAME:'operator',BOOTSTRAP_EMAIL:'',BOOTSTRAP_PASSWORD:password}).email).toBeNull();
  });
  it.each([{}, {BOOTSTRAP_USERNAME:'a'}, {BOOTSTRAP_USERNAME:'admin@example.com'}, {BOOTSTRAP_USERNAME:'operator',BOOTSTRAP_EMAIL:'invalid'}])('rejects missing or invalid identities',identity=>{
    expect(()=>parseBootstrapCredentials({...identity,BOOTSTRAP_PASSWORD:password})).toThrow('Provide a valid');
  });
  it.each([undefined,'Demo123!','short','a'.repeat(73),'界'.repeat(25)])('rejects missing, demo, short or excessive-byte passwords',value=>{
    expect(()=>parseBootstrapCredentials({BOOTSTRAP_USERNAME:'operator',BOOTSTRAP_PASSWORD:value})).toThrow('Provide a valid');
  });
  it('does not disclose invalid credentials in its error',()=>{
    try{
      parseBootstrapCredentials({BOOTSTRAP_USERNAME:'private@invalid',BOOTSTRAP_PASSWORD:'sensitive'});
      throw new Error('Expected validation rejection');
    }catch(error){
      const message=(error as Error).message;
      expect(message).not.toContain('sensitive');
      expect(message).not.toContain('private@invalid');
    }
  });
});
