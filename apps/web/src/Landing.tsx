import { useState } from 'react';
import { Camera, Mail, MapPin, Menu, MessageCircle, X } from 'lucide-react';
import './landing.css';

type LandingProps={signedIn:boolean};

export function Landing({signedIn}:LandingProps){
  const[menuOpen,setMenuOpen]=useState(false);
  return <div className="landing-page">
    <a className="skip-link" href="#main-content">Lewati ke konten utama</a>
    <header className="landing-header">
      <div className="landing-container landing-nav">
        <a className="landing-brand" href="#beranda" aria-label="Borneo Marketplace, kembali ke beranda">
          <img src="/assets/logo.png" width="46" height="54" alt=""/>
          <span><strong>Borneo</strong> Marketplace</span>
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
            <h1 id="hero-title">Kebutuhan rumah tangga dan dapur, <span>lebih mudah.</span></h1>
            <div className="hero-buttons">
              <a className="landing-button primary" href="#kemitraan">Daftar jadi mitra</a>
              <a className="landing-button secondary" href={signedIn?'/app':'/login'}>{signedIn?'Buka dashboard':'Masuk sistem'}</a>
            </div>
          </div>
        </section>
        <section className="identity-strip" aria-label="Tentang platform">
          <div className="landing-container identity-content">
            <div className="identity-owner"><img src="/assets/logo.png" width="38" height="44" alt=""/><span><strong>Borneo Marketplace</strong></span></div>
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
            <div className="location-line"><MapPin size={18}/><span>Sambas, Kalimantan Barat</span></div>
          </div>
          <div className="about-mark" aria-label="Identitas Borneo Marketplace">
            <img src="/assets/logo.png" width="260" height="300" alt="Logo Borneo Marketplace"/>
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
            <p className="section-kicker">Hubungi admin</p>
            <h3>Mulai kemitraan bersama kami</h3>
            <div className="contact-list">
              <span><MessageCircle size={20}/><b>WhatsApp</b><small>Segera tersedia</small></span>
              <span><Mail size={20}/><b>Email</b><small>Segera tersedia</small></span>
              <span><Camera size={20}/><b>Instagram</b><small>Segera tersedia</small></span>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer className="landing-footer">
      <div className="landing-container footer-layout">
        <div className="footer-identity"><a className="footer-logo" href="#beranda" aria-label="Borneo Marketplace, kembali ke beranda"><img src="/assets/logo.png" width="96" height="104" alt=""/></a><a className="landing-brand" href="#beranda"><span><strong>Borneo</strong> Marketplace</span></a><p>Platform pengadaan kebutuhan dapur terintegrasi.</p></div>
        <div><h3>Alamat</h3><address>Sambas, Kalimantan Barat</address></div>
        <div><h3>Navigasi</h3><a href="#tentang">Tentang kami</a><a href="#kemitraan">Kemitraan</a><a href={signedIn?'/app':'/login'}>{signedIn?'Dashboard':'Masuk sistem'}</a></div>
      </div>
      <div className="landing-container footer-bottom">© {new Date().getFullYear()} Borneo Marketplace || Published by VortxLab</div>
    </footer>
  </div>
}
