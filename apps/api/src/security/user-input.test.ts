import { expect,it } from 'vitest';
import { usernameInput,optionalEmailInput } from './user-input.js';
it('normalizes usernames and keeps the email namespace distinct',()=>{
  expect(usernameInput.parse(' Dapur.Tulip ')).toBe('dapur.tulip');
  for(const value of ['ab','has space','name@example.com','-first','a'.repeat(65)]){
    expect(usernameInput.safeParse(value).success).toBe(false);
  }
});
it('accepts optional email but validates supplied addresses',()=>{
  for(const value of [undefined,null,'']) expect(optionalEmailInput.parse(value)).toBeNull();
  expect(optionalEmailInput.parse(' USER@EXAMPLE.COM ')).toBe('user@example.com');
  expect(optionalEmailInput.safeParse('invalid').success).toBe(false);
});
