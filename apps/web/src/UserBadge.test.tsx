import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {UserBadge} from './UserBadge';

describe('shared account identity',()=>{
  it.each(['ADMIN','SUPERADMIN','BUYER'] as const)('shows only the account name for %s', role=>{
    const html=renderToStaticMarkup(<UserBadge user={{name:'Admin Mentawa',role}}/>);
    expect(html).toContain('class="user-chip-name">Admin Mentawa');
    expect(html).not.toContain('user-chip-role');
    expect(html).not.toContain('<small');
    expect(html).toContain('aria-label="Akun Admin Mentawa"');
    expect(html).toContain('title="Admin Mentawa"');
    expect(html).toContain('aria-hidden="true">AM');
    expect(html).not.toContain('<button');
  });
  it('handles extra spaces, single-word and missing names',()=>{
    for(const [name,initials] of [['  Dapur   Melati  ','DM'],['Superadmin','S'],['  ','P']]){
      expect(renderToStaticMarkup(<UserBadge user={{name,role:'BUYER'}}/>)).toContain(`aria-hidden="true">${initials}`);
    }
  });
  it('escapes names and retains the full name in the tooltip',()=>{
    const html=renderToStaticMarkup(<UserBadge user={{name:'Dapur <Utama> Cabang Sambas Kalimantan Barat',role:'BUYER'}}/>);
    expect(html).toContain('title="Dapur &lt;Utama&gt; Cabang Sambas Kalimantan Barat"');
    expect(html).not.toContain('Buyer');
    expect(html).not.toContain('<Utama>');
  });
});
