import { useEffect, useState, type ReactNode } from 'react';
import { Mail, MapPin, Menu, X } from 'lucide-react';
import './landing.css';
import {api} from './api';
import {defaultWebsite,type WebsiteSettings} from './website';
import {LandingUpdates} from './LandingUpdates';

type LandingProps={signedIn:boolean};
const landingNavigation=[
  {href:'#harga-bahan-pokok',label:'Harga Bahan Pokok'},
  {href:'#berita',label:'Berita'},
  {href:'#tentang',label:'Tentang kami'},
  {href:'#kemitraan',label:'Kemitraan'},
  {href:'#kontak',label:'Kontak'},
];

export function Landing({signedIn}:LandingProps){
  const[menuOpen,setMenuOpen]=useState(false);
  const[website,setWebsite]=useState<WebsiteSettings>(defaultWebsite);
  useEffect(()=>{let active=true;api<WebsiteSettings>('/website').then(value=>{if(active)setWebsite(value)}).catch(()=>{});return()=>{active=false}},[]);
  return <div className="landing-page">
    <a className="skip-link" href="#main-content">Lewati ke konten utama</a>
    <header className="landing-header">
      <div className="landing-container landing-nav">
        <a className="landing-brand" href="#beranda" aria-label="Borneo Marketplace, kembali ke beranda">
          <img src="/assets/logo/logo.webp" width="46" height="54" alt=""/>
          <span className="brand-wordmark">Borneo<br/>Marketplace</span>
        </a>
        <button className="mobile-menu" type="button" aria-label={menuOpen?'Tutup menu':'Buka menu'} aria-expanded={menuOpen} onClick={()=>setMenuOpen(value=>!value)}>{menuOpen?<X/>:<Menu/>}</button>
        <nav className={menuOpen?'landing-links open':'landing-links'} aria-label="Navigasi utama">
          {landingNavigation.map(item=><a key={item.href} href={item.href} onClick={()=>setMenuOpen(false)}>{item.label}</a>)}
          <a className="landing-login" href={signedIn?'/app':'/login'}>{signedIn?'Buka dashboard':'Masuk sistem'}</a>
        </nav>
      </div>
    </header>

    <main id="main-content">
      <div className="landing-intro" id="beranda">
        <section className="landing-hero" aria-labelledby="hero-title">
          <div className="landing-container hero-copy">
            <h1 id="hero-title"><span className="hero-title-line">Selamat Datang di</span><span className="hero-title-line">Borneo Marketplace</span></h1>
            <div className="hero-buttons">
              <a className="landing-button primary" href="#kemitraan">Daftar jadi mitra</a>
              <a className="landing-button secondary" href={signedIn?'/app':'/login'}>{signedIn?'Buka dashboard':'Masuk sistem'}</a>
            </div>
          </div>
        </section>
        <section className="identity-strip" aria-label="Tentang platform">
          <div className="landing-container identity-content">
            <div className="identity-owner"><img src="/assets/logo/logo.webp" width="38" height="44" alt=""/><span><strong>Borneo Marketplace</strong></span></div>
            <p>Borneo Marketplace merupakan platform pengadaan kebutuhan dapur terintegrasi dengan harga yang transparan. Mulai dari memilih produk, membuat pesanan, hingga memantau pengiriman, semua terhubung dalam satu sistem yang praktis dan mudah digunakan.</p>
          </div>
        </section>
      </div>

      <LandingUpdates/>
      <section className="landing-about" id="tentang" aria-labelledby="about-title">
        <div className="about-decoration" aria-hidden="true"/>
        <div className="landing-container about-layout">
          <div className="about-copy">
            <p className="section-kicker">Tentang kami</p>
            <h2 id="about-title"><span>Borneo</span> Marketplace</h2>
            <p>Kami menghubungkan mitra dapur dengan kebutuhan bahan pokok melalui pengadaan yang lebih tertata. Katalog, harga, dan ketersediaan produk dapat dilihat dalam satu tempat, sehingga mitra dapat merencanakan kebutuhan dan memantau pesanan dengan lebih mudah.</p>
            <div className="location-line"><MapPin size={18}/><span>{website.address}</span></div>
          </div>
          <div className="about-mark" aria-label="Identitas Borneo Marketplace">
            <img src="/assets/logo/logo.webp" width="260" height="300" alt="Logo Borneo Marketplace"/>
          </div>
        </div>
      </section>

      <section className="landing-partner" id="kemitraan" aria-labelledby="partner-title">
        <div className="landing-container partner-layout">
          <div className="partner-copy">
            <h2 id="partner-title">Daftar jadi mitra</h2>
            <p>Hubungi tim Borneo Marketplace untuk verifikasi dan pembuatan akun dapur. Setelah akun aktif, Anda dapat melihat katalog, mengecek harga, dan memesan kebutuhan dapur.</p>
          </div>
          <div className="contact-box" id="kontak">
            <p className="partner-contact-intro">Hubungi kontak admin di bawah ini untuk bergabung menjadi bagian dari Borneo Marketplace.</p>
            <div className="contact-list" aria-label="Kontak Borneo Marketplace">
              <div className="social-contact"><SocialContact label="WhatsApp" href={website.whatsapp?`https://wa.me/${website.whatsapp}`:undefined}><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg></SocialContact><span>WhatsApp</span></div>
              <div className="social-contact"><SocialContact label="Email" href={website.email?`mailto:${website.email}`:undefined}><Mail size={22}/></SocialContact><span>Email</span></div>
              <div className="social-contact"><SocialContact label="Instagram" href={website.instagram?`https://www.instagram.com/${website.instagram}/`:undefined}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/></svg></SocialContact><span>Instagram</span></div>
            </div>
          </div>
        </div>
      </section>
    </main>
    <footer className="landing-footer">
      <div className="landing-container footer-layout">
        <div className="footer-identity"><a className="landing-brand" href="#beranda" aria-label="Borneo Marketplace, kembali ke beranda"><img src="/assets/logo/logo.webp" width="52" height="56" alt=""/><div className="footer-brand-copy"><span className="brand-wordmark">Borneo<br/>Marketplace</span><span className="footer-description">Platform pengadaan<br/>kebutuhan dapur terintegrasi</span></div></a></div>
        <div><h3>Alamat</h3><address>{website.address}</address></div>
        <nav className="footer-navigation" aria-label="Navigasi footer"><h3>Navigasi</h3><div className="footer-links">{landingNavigation.map(item=><a key={item.href} href={item.href}>{item.label}</a>)}<a href={signedIn?'/app':'/login'}>{signedIn?'Buka dashboard':'Masuk sistem'}</a></div></nav>
      </div>
      <div className="landing-container footer-bottom"><span>© {new Date().getFullYear()} Borneo Marketplace. All Rights Reserved.</span><span>Published by VortxLab.</span></div>
    </footer>
  </div>
}

function SocialContact({label,href,children}:{label:string;href?:string;children:ReactNode}){
  if(!href)return <span className="social-icon unavailable" role="img" aria-label={label}>{children}</span>;
  return <a className="social-icon" href={href} aria-label={label} target={href.startsWith('https:')?'_blank':undefined} rel="noopener noreferrer">{children}</a>;
}
