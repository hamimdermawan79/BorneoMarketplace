import {useEffect,useState,type FormEvent} from 'react';
import {api} from './api';
import {defaultWebsite,type WebsiteSettings} from './website';
import './website-management.css';
import {LandingContentManagement} from './LandingContentManagement';

export function WebsiteManagement(){
  const [section,setSection]=useState<'content'|'contact'>('content');
  const [settings,setSettings]=useState<WebsiteSettings>(defaultWebsite);
  const [loading,setLoading]=useState(true);
  const [loaded,setLoaded]=useState(false);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const load=async()=>{
    setLoading(true);setError('');
    try{setSettings(await api<WebsiteSettings>('/website'));setLoaded(true);}
    catch(reason){setError((reason as Error).message);}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);
  const save=async(event:FormEvent)=>{
    event.preventDefault();if(saving||loading||!loaded)return;
    setSaving(true);setNotice('');setError('');
    try{
      setSettings(await api<WebsiteSettings>('/management/website',{method:'PUT',body:JSON.stringify(settings)}));
      setNotice('Kontak dan alamat website berhasil disimpan.');
    }catch(reason){setError((reason as Error).message);}
    finally{setSaving(false);}
  };
  const field=(key:keyof WebsiteSettings,value:string)=>setSettings(current=>({...current,[key]:value}));
  if(loading)return <p role="status">Memuat pengaturan website…</p>;
  if(!loaded)return <div className="website-management"><p className="notice" role="alert">{error}</p><button onClick={()=>void load()}>Coba lagi</button></div>;
  return <div className="website-workspace">
    <div className="website-workspace-nav" role="group" aria-label="Pengelolaan website">
      <button aria-pressed={section==='content'} onClick={()=>setSection('content')}>Konten Landing Page</button>
      <button aria-pressed={section==='contact'} onClick={()=>setSection('contact')}>Kontak & Alamat</button>
      <a href="/" target="_blank" rel="noopener noreferrer">Lihat Website ↗</a>
    </div>
    <div hidden={section!=='contact'}><div className="website-management">
    {notice&&<p className="notice" role="status">{notice}</p>}
    {error&&<p className="notice" role="alert">{error}</p>}
    <form className="panel website-settings-form" onSubmit={save}>
      <fieldset disabled={saving}>
        <legend>Kontak admin</legend>
        <div className="website-fields">
          <label>WhatsApp<input type="tel" autoComplete="tel" maxLength={40} placeholder="6281234567890" value={settings.whatsapp} onChange={event=>field('whatsapp',event.target.value)}/><small>Nomor 08 akan otomatis menggunakan kode negara 62.</small></label>
          <label>Email<input type="email" autoComplete="email" maxLength={254} placeholder="admin@example.com" value={settings.email} onChange={event=>field('email',event.target.value)}/></label>
          <label>Instagram<input type="text" autoCapitalize="none" spellCheck={false} maxLength={31} placeholder="@username" value={settings.instagram} onChange={event=>field('instagram',event.target.value)}/></label>
          <label className="website-address">Alamat<textarea rows={3} required minLength={3} maxLength={300} value={settings.address} onChange={event=>field('address',event.target.value)}/></label>
        </div>
        <div className="website-settings-actions"><a href="/" target="_blank" rel="noopener noreferrer">Lihat website</a><button className="primary" type="submit">{saving?'Menyimpan…':'Simpan perubahan'}</button></div>
      </fieldset>
    </form>
  </div></div><div hidden={section!=='content'}><LandingContentManagement/></div></div>;
}
