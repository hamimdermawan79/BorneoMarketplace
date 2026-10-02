import { useEffect, useState, type ReactNode } from 'react';
import { Mail, MapPin, Menu, X } from 'lucide-react';
import './landing.css';
import {api} from './api';
import {defaultWebsite,type WebsiteSettings} from './website';

type LandingProps={signedIn:boolean};

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
          <a href="#tentang" onClick={()=>setMenuOpen(false)}>Tentang kami</a>
          <a href="#kemitraan" onClick={()=>setMenuOpen(false)}>Kemitraan</a>
          <a href="#kontak" onClick={()=>setMenuOpen(false)}>Kontak</a>
          <a className="landing-login" href={signedIn?'/app':'/login'}>{signedIn?'Buka dashboard':'Masuk sistem'}</a>
        </nav>
      </div>
    </header>

    <main id="main-content">
      <div className="landing-intro" id="beranda">
        <section className="landing-hero" aria-labelledby="hero-title">
          <div className="landing-container hero-copy">
            <p className="landing-kicker">Borneo Marketplace</p>
            <h1 id="hero-title">Selamat Datang di <span>Borneo Marketplace</span></h1>
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

      <section className="landing-about" id="tentang" aria-labelledby="about-title">
        <div className="landing-container about-layout">
          <div className="about-copy">
            <p className="section-kicker">Tentang kami</p>
            <h2 id="about-title">Borneo Marketplace</h2>
            <h3>Kebutuhan rumah tangga dan dapur.</h3>
            <p>Kami menghubungkan mitra dapur dengan kebutuhan bahan pokok melalui pengadaan yang lebih tertata. Katalog, harga, dan ketersediaan produk dapat dilihat dalam satu tempat, sehingga mitra dapat merencanakan kebutuhan dan memantau pesanan dengan lebih mudah.</p>
            <div className="location-line"><MapPin size={18}/><span>{website.address}</span></div>
          </div>
          <div className="about-mark" aria-label="Identitas Borneo Marketplace">
            <img src="/assets/logo/logo.webp" width="260" height="300" alt="Logo Borneo Marketplace"/>
          </div>
        </div>
      </section>

      <section className="landing-partner" id="kemitraan" aria-labelledby="partner-title">
        <div className="partner-divider" aria-hidden="true"/>
        <div className="landing-container partner-layout">
          <div className="partner-copy">
            <h2 id="partner-title">Daftar jadi mitra</h2>
            <p>Hubungi tim Borneo Marketplace untuk verifikasi dan pembuatan akun dapur. Setelah akun aktif, Anda dapat melihat katalog, mengecek harga, dan memesan kebutuhan dapur.</p>
          </div>
          <div className="contact-box" id="kontak">
            <p className="partner-contact-intro">Hubungi kontak admin di bawah ini untuk bergabung menjadi bagian dari Borneo Marketplace.</p>
            <div className="contact-list" aria-label="Kontak Borneo Marketplace">
              <div className="social-contact"><SocialContact label="WhatsApp" href={website.whatsapp?`https://wa.me/${website.whatsapp}`:undefined}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.3-4.8A8.5 8.5 0 1 1 20.5 11.7Z"/><path d="M8 7.4c-.6.3-.9 1-.7 1.8.6 2.5 3 4.9 5.7 5.6.8.2 1.7-.2 2-1l.3-.7-2-1.1-.8.8c-1.3-.5-2.4-1.6-2.9-2.9l.7-.9-1.1-2Z"/></svg></SocialContact><span>WhatsApp</span></div>
              <div className="social-contact"><SocialContact label="Email" href={website.email?`mailto:${website.email}`:undefined}><Mail size={22}/></SocialContact><span>Email</span></div>
              <div className="social-contact"><SocialContact label="Instagram" href={website.instagram?`https://www.instagram.com/${website.instagram}/`:undefined}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/></svg></SocialContact><span>Instagram</span></div>
            </div>
          </div>
        </div>
      </section>
    </main>
    <footer className="landing-footer">
      <div className="landing-container footer-layout">
        <div className="footer-identity"><a className="footer-logo" href="#beranda" aria-label="Borneo Marketplace, kembali ke beranda"><img src="/assets/logo/logo.webp" width="96" height="104" alt=""/></a><a className="landing-brand" href="#beranda"><span className="brand-wordmark">Borneo<br/>Marketplace</span></a><p>Platform pengadaan kebutuhan dapur terintegrasi.</p></div>
        <div><h3>Alamat</h3><address>{website.address}</address></div>
        <div><h3>Navigasi</h3><a href="#tentang">Tentang kami</a><a href="#kemitraan">Kemitraan</a><a href={signedIn?'/app':'/login'}>{signedIn?'Dashboard':'Masuk sistem'}</a></div>
      </div>
      <div className="landing-container footer-bottom">© {new Date().getFullYear()} Borneo Marketplace All Right Reserved | Published by VortxLab.</div>
    </footer>
  </div>
}

function SocialContact({label,href,children}:{label:string;href?:string;children:ReactNode}){
  if(!href)return <span className="social-icon unavailable" role="img" aria-label={label}>{children}</span>;
  return <a className="social-icon" href={href} aria-label={label} target={href.startsWith('https:')?'_blank':undefined} rel="noopener noreferrer">{children}</a>;
}
