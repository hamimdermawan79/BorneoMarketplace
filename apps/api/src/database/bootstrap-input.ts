import {optionalEmailInput,usernameInput} from '../security/user-input.js';

export function parseBootstrapCredentials(environment:NodeJS.ProcessEnv){
  const username=environment.BOOTSTRAP_USERNAME===undefined?null:usernameInput.safeParse(environment.BOOTSTRAP_USERNAME);
  const email=optionalEmailInput.safeParse(environment.BOOTSTRAP_EMAIL?.trim());
  const password=environment.BOOTSTRAP_PASSWORD;
  if((username&&!username.success)||!email.success||(!username&&!email.data)||!password||password.length<12||Buffer.byteLength(password)>72||password==='Demo123!'){
    // Never include input values: this CLI may be invoked by a production operator.
    throw new Error('Provide a valid BOOTSTRAP_USERNAME or BOOTSTRAP_EMAIL, and a unique BOOTSTRAP_PASSWORD (at least 12 characters, at most 72 UTF-8 bytes).');
  }
  return {username:username?.data??null,email:email.data,password};
}
