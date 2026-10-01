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
- cluster admin–dapur yang membatasi produk, harga, stok, dan pesanan;
- Produk Pokok dikelola Superadmin dan otomatis tersedia untuk seluruh Admin Koperasi;
- Admin dapat menambahkan produk tambahan beserta foto persegi; produk tersebut hanya berlaku pada cluster Admin pembuatnya;
- pencatatan stok per admin berisi produk, satuan, jumlah, harga jual, serta sumber `Koperasi` atau `Vendor`;
- sumber stok default adalah `Koperasi`; kolom vendor hanya muncul untuk stok dari luar koperasi, memberi saran nama yang pernah digunakan, dan otomatis menyimpan nama vendor baru;
- reservasi stok saat checkout dan pengembalian stok saat pembatalan;
- pemisahan otomatis daftar penyiapan berdasarkan sumber barang;
- checklist per alokasi sumber, termasuk satu produk yang terbagi ke koperasi dan vendor;
- telur dalam pcs dan ayam dalam potong, dengan harga, estimasi, serta berat aktual dalam kilogram;
- alur pesanan tanpa pembayaran: masuk, disiapkan, dikirim, menunggu dapur, selesai;
- ekspor PDF operasional dan tabel keuangan Excel (`.xls`).

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
