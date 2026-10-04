import {ArrowLeft,Compass,Share,SquarePlus,Check} from 'lucide-react';
import './landing.css';

const steps=[
  {title:'Buka Website di Safari',Icon:Compass,description:<>Kunjungi <a href="https://borneomarketplace.web.id">borneomarketplace.web.id</a> di iPhone atau iPad.</>},
  {title:'Ketuk Bagikan',Icon:Share,description:<>Cari ikon kotak dengan panah ke atas pada menu Safari.</>},
  {title:'Tambahkan ke Layar Utama',Icon:SquarePlus,description:<>Pilih <strong>Add to Home Screen</strong>. Gulir menu jika pilihan belum terlihat.</>},
  {title:'Konfirmasi Tambah',Icon:Check,description:<>Jika tersedia, aktifkan <strong>Buka sebagai App</strong>, lalu ketuk <strong>Tambah</strong>.</>},
];
export function IosGuide(){return <main className="landing-page ios-guide"><div className="landing-container">
  <a className="ios-guide-back" href="/#download-aplikasi"><ArrowLeft size={18} aria-hidden="true"/>Kembali ke Website</a>
  <div className="ios-guide-layout"><header className="ios-guide-intro"><img src="/assets/logo/apple.svg" width="40" height="40" alt=""/><p className="section-kicker">Panduan iPhone &amp; iPad</p><h1>Borneo di<br/>Layar Utama.</h1><p>Akses website seperti aplikasi, tanpa App Store.</p><p className="ios-guide-note">Penambahan dilakukan melalui menu Safari, bukan otomatis dari website.</p></header>
    <ol className="ios-guide-steps">{steps.map(({title,Icon,description},index)=><li key={title}><span className="ios-step-number" aria-hidden="true">{index+1}</span><div><div className="ios-step-title"><Icon size={20} aria-hidden="true"/><h2>{title}</h2></div><p>{description}</p></div></li>)}</ol>
  </div><div className="ios-guide-finish"><img src="/assets/logo/logo.webp" width="40" height="44" alt=""/><p><strong>Siap digunakan.</strong><br/>Buka ikon Borneo Marketplace dari layar utama. Koneksi internet tetap diperlukan.</p></div>
</div></main>}
