# Borneo Marketplace

Aplikasi pengadaan tertutup antara Koperasi Borneo Mandiri dan dapur mitra. Versi ini adalah fondasi aplikasi produksi yang memakai React, Fastify, dan PostgreSQL lokal.

## Menjalankan lokal

Prasyarat: Node.js 22.12+ dan PostgreSQL 16+.

1. Buat database bernama `borneo_marketplace`.
2. Salin `apps/api/.env.example` menjadi `apps/api/.env`, lalu isi koneksi PostgreSQL dan secret JWT lokal.
3. Instal dependensi dan siapkan database:

   ```bash
   npm ci
   npm run db:migrate
   npm run db:secure
   npm run db:seed
   ```

4. Jalankan API dan web:

   ```bash
   npm run dev
   ```

Web: `http://127.0.0.1:5173`  
API: `http://127.0.0.1:4000`

## Akun demo

Semua akun demo memakai password `Demo123!`.

| Role | Email | Cakupan |
|---|---|---|
| Superadmin | `superadmin@borneo.local` | Seluruh cluster dan laporan |
| Admin A | `admin.a@borneo.local` | Dapur Tulip dan Melati |
| Admin B | `admin.b@borneo.local` | Dapur Kenanga dan Cempaka |
| Admin C | `admin.c@borneo.local` | Dapur Rafflesia |
| Buyer | `tulip@borneo.local` | Dapur Tulip · Admin A |
| Buyer | `melati@borneo.local` | Dapur Melati · Admin A |
| Buyer | `kenanga@borneo.local` | Dapur Kenanga · Admin B |
| Buyer | `cempaka@borneo.local` | Dapur Cempaka · Admin B |
| Buyer | `rafflesia@borneo.local` | Dapur Rafflesia · Admin C |

Halaman `/login` menyediakan pemilih akun demo hanya pada development. Seed dan login dengan password demo ditolak pada mode production. Jangan gunakan seed untuk data operasional asli.

`db:secure` dijalankan sekali untuk membuat role `borneo_runtime` dan menyimpan koneksinya di `apps/api/.env.runtime`. Perintah ini menolak menimpa role atau file yang sudah ada. API mengutamakan `.env.runtime`; migrasi lokal memakai koneksi pemilik dari `.env`. Restart API setelah provisioning. Kedua file berisi rahasia dan tidak boleh diunggah.

## Fitur yang sudah tersedia

- autentikasi JWT dan otorisasi role di API;
- pengelolaan akun: Superadmin melalui Pengguna & Role, Admin Koperasi melalui Akun Mitra (hanya buyer dalam cluster miliknya), dan buyer melalui Profil (nomor HP dan password sendiri);
- perubahan identitas, username, email opsional, status, informasi dapur, dan reset password tercatat di audit. Pengalihan admin hanya oleh Superadmin; role tetap dikelola di tabel Pengguna & Role. Akun bersejarah dinonaktifkan, bukan dihapus;
- reset password membutuhkan password pengelola saat ini, sedangkan perubahan password sendiri membutuhkan password lama. Semua token lama ditolak setelah perubahan password; password/hash tidak disertakan dalam respons atau audit;
- cluster admin–dapur yang membatasi produk, harga, stok, dan pesanan;
- Produk Pokok dikelola Superadmin dan otomatis tersedia untuk seluruh Admin Koperasi; sumbernya default `Koperasi` dan hanya Superadmin yang dapat mengubahnya menjadi `Vendor`;
- Admin dapat menambahkan produk tambahan beserta foto persegi; produk tersebut hanya berlaku pada cluster Admin pembuatnya;
- pencatatan stok per admin berisi produk, satuan, jumlah, harga jual, serta sumber `Koperasi` atau `Vendor`;
- sumber Produk Pokok mengikuti pengaturan Superadmin dan tidak dapat diganti Admin Koperasi; Produk Baru/tambahan tetap boleh memilih sumber sendiri. Perubahan sumber master hanya berlaku untuk penambahan stok berikutnya, tanpa mengubah stok atau transaksi lama;
- kolom nama vendor hanya muncul untuk sumber `Vendor`, memberi saran nama yang pernah digunakan, dan otomatis menyimpan nama vendor baru;
- reservasi stok saat checkout dan pengembalian stok saat pembatalan;
- pemisahan otomatis daftar penyiapan berdasarkan sumber barang;
- checklist per alokasi sumber, termasuk satu produk yang terbagi ke koperasi dan vendor;
- telur dalam pcs dan ayam dalam potong, dengan harga, estimasi, serta berat aktual dalam kilogram;
- alur pesanan tanpa pembayaran: masuk, disiapkan, dikirim, menunggu dapur, selesai;
- ekspor PDF operasional dan tabel keuangan Excel (`.xls`).

## Gambar produk

Foto dapat diunggah oleh Admin Koperasi maupun Superadmin dalam format PNG, JPG/JPEG, WebP, atau HEIC/HEIF. Server memeriksa isi file, bukan hanya ekstensi (file `.pn` yang sebenarnya PNG juga dapat dipilih). Batas unggahan 8 MB dan 50 megapiksel. Gambar dikonversi menjadi WebP, sisi terpanjang maksimal 1280 px, orientasi disesuaikan, dan metadata dibuang. Editor produk non-pokok tetap menyediakan crop 1:1 dengan hasil 640 × 640 px.

Endpoint `POST /api/images/convert` menerima binary `application/octet-stream`, hanya untuk admin/superadmin. Maksimum 2 konversi bersamaan, timeout 20 detik, dan rate limit 12 unggahan/menit per IP. Proses HEIC dijalankan dalam worker agar tidak memblokir request API lain. Data URL hanya dipakai sementara untuk preview/crop; saat formulir disimpan, API mengonversi ulang gambar dan menyimpan file WebP private. Database menyimpan referensi gambar, bukan base64.

Aset publik dan foto operasional dipisahkan:

```text
apps/web/public/assets/
  logo/          logo.webp, favicon.ico
  background/    background.webp
  decoration/    pattern1.webp, motif-awan.svg, login-cloud-*.svg
storage/private/produk/
  produk-pokok/       <uuid>.webp
  produk-tambahan/    <uuid>.webp
```

Foto produk tidak masuk Git atau hasil build frontend. `GET /api/product-images/:jenis/:filename` memeriksa login dan hak akses setiap request; admin hanya dapat membaca Produk Pokok dan produk miliknya, buyer mengikuti admin pengelolanya, superadmin memiliki akses penuh. Frontend mengambil foto menggunakan authorization header, lalu menampilkan blob sementara. Cache gambar bersifat `private, no-store`.

Pada VPS, set `PRODUCT_STORAGE_DIR` ke direktori absolut persistent di luar webroot (misalnya `/var/lib/borneo-marketplace/produk`), dengan akses filesystem hanya untuk service API. Jangan buat Nginx alias/static route ke folder ini; `/api/` diteruskan ke API. Struktur `produk-pokok/produk-tambahan` otomatis dibuat. Saat pindah server, salin folder private bersama database. `npm run db:backup` menyimpan dump beserta foto yang direferensikan ke folder `.dump.media`; hentikan penulisan selama backup agar snapshot DB/file konsisten. File yang tidak lagi direferensikan tidak disajikan dan tidak otomatis dihapus agar backup/restore tetap aman.

Untuk migrasi foto lama: backup dahulu, lalu jalankan `npm run db:images`. CLI mempertahankan referensi yang sudah private, memindahkan data gambar lama ke storage private, dan tidak menghapus sumbernya. Jalankan CLI dengan pengguna OS pemilik storage/service API agar file berizin `0600` tetap dapat dibaca API; kredensial database maintenance hanya diberikan ke proses CLI, bukan server HTTP. Seed demo tidak bergantung pada foto publik.

Untuk aset baru PNG/JPEG, `node scripts/convert-assets.mjs` menghasilkan WebP tanpa menimpa output existing. `npm run assets:organize` merapikan aset branding, membuat favicon dari logo, dan memindahkan PNG pattern yang telah dikonversi ke folder backup. SVG dekoratif tetap SVG.

Pada reverse proxy VPS, izinkan body hingga `8m` untuk `/api/images/convert` dan waktu respons setidaknya 30 detik. Jangan naikkan limit seluruh API tanpa kebutuhan. Gunakan `npm ci` di VPS target agar binary Sharp sesuai OS; jangan salin `node_modules` dari Windows. Engine memakai Sharp dan decoder HEIC portabel, bukan executable ImageMagick eksternal.

Referensi: [Sharp WebP dan metadata](https://sharp.pixelplumbing.com/api-output/), [HEIC converter dan worker](https://github.com/catdad-experiments/heic-convert).

## Perintah verifikasi

```bash
npm test
npm run build
npm audit --audit-level=moderate
```

Uji integrasi PostgreSQL setelah `db:secure`: `npm run test:security`. Pengujian membuat database sementara `borneo_security_test_<uuid>` dan menghapus database tersebut setelah selesai; membutuhkan akun maintenance dengan hak membuat database. Data operasional tidak dipakai sebagai fixture.

## Catatan keamanan

File `.env`, `.env.runtime`, dan backup tidak masuk Git. Jangan memasukkan password PostgreSQL produksi, JWT secret, atau kredensial lain ke repository. Mengabaikan file di Git tidak menghapus rahasia yang pernah terlanjur masuk riwayat commit: rotasi rahasia tersebut jika pernah dipublikasikan.

Panduan pemisahan kredensial, backup, reset demo, persiapan VPS, hasil verifikasi, dan batas audit ada di [docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md).

Keputusan produk dan aturan bisnis lebih lengkap ada di [docs/PRD-v0.2.md](docs/PRD-v0.2.md).

## Deployment Production

Template Ubuntu 24, GitHub Actions (test/build lalu auto-deploy setelah merge `main`),
Nginx/systemd, pemisahan secret/data, backup sebelum migrasi, dan konfigurasi Cloudflare
ada di [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Deploy belum aktif sampai VPS selesai
di-provision dan repository variable `DEPLOY_ENABLED=true` dibuat. Jangan menjalankan
template dengan placeholder atau mengunggah `.env`/foto/backup ke GitHub.

Database production baru menggunakan `db:bootstrap`, bukan `db:seed`. CLI menerima
`BOOTSTRAP_USERNAME` dan/atau `BOOTSTRAP_EMAIL` opsional, serta `BOOTSTRAP_PASSWORD`
unik minimal 12 karakter dan maksimal 72 byte UTF-8. Username dapat dipakai untuk
login tanpa email demo. Bootstrap menolak database yang sudah berisi user, menyimpan
hash bcrypt (bukan password plaintext), dan tidak mencetak credential. Masukkan password
langsung pada terminal/proses maintenance terpisah; jangan simpan dalam repo atau chat.
