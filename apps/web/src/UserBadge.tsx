import type {User} from './api';

export function UserBadge({user}:{user:Pick<User,'name'|'role'>}){
  const name=user.name.trim()||'Pengguna';
  const initials=name.split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join('').toLocaleUpperCase('id-ID');
  return <div className="user-chip" role="group" aria-label={`Akun ${name}`} title={name}>
    <span className="user-chip-avatar" aria-hidden="true">{initials}</span>
    <div className="user-chip-details"><strong className="user-chip-name">{name}</strong></div>
  </div>;
}
