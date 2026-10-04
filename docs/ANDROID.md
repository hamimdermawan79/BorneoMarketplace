# Android APK — Borneo Marketplace

APK ini adalah shell Android WebView untuk `https://borneomarketplace.web.id/app`,
bukan salinan frontend/API lokal. Perubahan website mengikuti deployment VPS;
perubahan shell native memerlukan build APK baru. Internet diperlukan.

- Package: `id.web.borneomarketplace`, versi `1.0.2` / versionCode `3`.
- Minimum Android 8.0 (API 26), target API 36.
- Ikon APK dan iOS Home Screen berasal dari artwork cyan yang diberikan pengguna.
  Sumber build: `apps/web/public/assets/logo/app-icon.webp`; PNG 180px untuk iOS
  dihasilkan oleh `scripts/android-icons.mjs`. Logo branding dan favicon tetap terpisah.
  Background adaptive icon transparan, bukan lingkaran/kotak putih tambahan.
  Area transparan ikon iOS diisi cyan karena iOS menggunakan ikon opaque dan mask OS.
- Mendukung portrait dan landscape dengan `fullUser`, mengikuti posisi perangkat
  dan pengaturan auto-rotate (tidak dikunci landscape). Gunakan posisi portrait
  di ponsel/emulator untuk tampilan tegak. Rotasi meresize WebView yang sama,
  sehingga formulir tidak dimuat ulang. Tablet/emulator dapat mengikuti orientasi
  natural/peraturan OS sendiri; tidak memaksakan portrait pada layar besar.
- WebView menghormati meta viewport, tidak melakukan narrow-column autosizing,
  dan mendukung pinch zoom tanpa tombol zoom yang menutupi halaman.
- DOM storage dan cookies dipertahankan, bukan dihapus saat aplikasi ditutup.
  Login pertama di APK tetap diperlukan karena penyimpanan terpisah dari browser.
  Masa berlaku token/logout/akun dinonaktifkan tetap mengikuti aturan server.
- HTTPS saja, tidak mengabaikan sertifikat invalid, tidak ada JavaScript bridge,
  akses file lokal dan third-party cookies dinonaktifkan.
- Link berita, Drive, WhatsApp, email, dan telepon dibuka pada aplikasi eksternal.
- Unggah gambar menggunakan pemilih dokumen sistem; tidak meminta akses seluruh galeri.
- PDF/Excel menggunakan dialog simpan sistem (maksimal 20 MB); ini membutuhkan
  perubahan `apps/web/src/api.ts` pada deployment website juga. APK tidak menggantikan
  frontend produksi secara otomatis sebelum merge/deploy.

## Build di Windows

Butuh JDK 17+, Gradle 9.2.0, Android SDK platform 36.1 dan build-tools 36.1.0.
Build pertama:

```powershell
pwsh -File scripts/build-android.ps1 -GradlePath C:/path/gradle-9.2.0/bin/gradle.bat
```

Build berikutnya memakai wrapper yang dihasilkan:

```powershell
pwsh -File scripts/build-android.ps1
```

Script menjalankan assemble release, lint, verifikasi signature, lalu menyalin
APK ke `apps/web/public/downloads/borneo-marketplace.apk`. File APK publik ini
boleh masuk Git supaya build Vite menyertakannya pada deploy biasa.

Signing key dan password disimpan **di luar repo**, di
`%LOCALAPPDATA%/BorneoMarketplace/android-signing`, dengan ACL privat.
Backup direktori ini ke lokasi privat yang aman. Jangan commit/upload isi direktori
ke repo publik atau web. Kehilangan signing key membuat APK update tidak bisa
dipasang di atas aplikasi lama. Jangan membuat key baru untuk update; naikkan
`versionCode` dan `versionName` di `apps/android/app/build.gradle`.

## Deploy download

Setelah merge dan redeploy, APK tersedia di `/downloads/borneo-marketplace.apk`.
Tombol Download APK yang sudah ada menggunakan URL tersebut.
Tambahkan blok `/downloads/` dari `deploy/ubuntu/nginx.conf.example` ke konfigurasi
Nginx VPS yang aktif, kemudian `sudo nginx -t` dan `sudo systemctl reload nginx`.
Blok ini mengembalikan MIME APK dan 404 jika file hilang, bukan HTML fallback SPA.
Jangan menimpa konfigurasi VPS secara buta jika memiliki perubahan lain.
Setelah website baru dideploy, hapus shortcut iOS lama lalu tambahkan ulang
melalui Safari agar menggunakan `apple-touch-icon-v3.png` yang baru.

## Breakpoint mobile pada WebView

Vite menargetkan Chrome/WebView 79 dan Safari 14 untuk syntax JS/CSS. Target CSS
ini menjaga `(max-width:680px)` agar tidak diminify menjadi `(width<=680px)`
yang diabaikan WebView lama, sehingga tampilan desktop tidak dipaksakan ke portrait.
Ini bukan jaminan semua API modern bekerja pada engine lama; tetap perbarui
Chrome/Android System WebView untuk keamanan dan dukungan API browser.

Setelah build frontend, jalankan regresi pada hasil produksi (bukan hanya dev CSS):

```powershell
npm run build -w @borneo/web
node scripts/check-webview-build.mjs
```

Perbaikan CSS harus ikut merge/redeploy website VPS. Menginstal APK baru saja
tidak mengganti CSS produksi karena APK memuat domain VPS, bukan localhost.

## Verifikasi perangkat sebelum distribusi luas

Build/lint dan signature bukan pengganti uji perangkat. Uji instalasi, login,
tutup/buka ulang, logout, tombol kembali, unggah foto, unduh PDF/Excel, link luar,
keyboard, rotasi, dan kondisi offline pada Android fisik. Repo tidak menyimpan
akun/password dalam APK. Distribusi APK langsung belum berarti publikasi Play Store.

Referensi: [Android WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview),
[AGP 9.0 compatibility](https://developer.android.com/build/releases/agp-9-0-0-release-notes).
