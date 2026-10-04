# Audit keamanan backend dan database

Tanggal: 30 September 2026. Lingkup: source API, autentikasi, otorisasi cluster, transaksi stok/pesanan, ekspor, konfigurasi dan PostgreSQL lokal. Perubahan dilakukan di branch `develop`. Ini hardening berbasis code review dan pengujian, bukan sertifikasi atau jaminan tidak adanya celah.

## Temuan dan perbaikan

| Prioritas | Temuan | Perbaikan |
|---|---|---|
| Tinggi | API menggunakan login PostgreSQL superuser | Role runtime terpisah tanpa superuser, create role/database, ownership, atau bypass RLS; production menolak role berlebih. Migrasi memakai proses maintenance terpisah. |
| Tinggi | Produk privat admin lain dapat ditautkan lewat API | Pemeriksaan kepemilikan di katalog, tambah produk, checkout, dan trigger integritas database. |
| Tinggi | Permintaan paralel bisa menggandakan pengiriman/pembatalan dan perubahan stok | Kunci baris pesanan sebelum validasi status, urutan kunci produk konsisten, transaksi atomik, dan kunci idempotensi checkout. |
| Tinggi | Klaim token dapat tertinggal setelah akun berubah | Verifikasi status akun/organisasi dan role setiap request; organisasi diambil ulang; perubahan hash password membatalkan token lama. |
| Tinggi | Login tanpa pembatasan dan password mitra baru dapat diprediksi | Rate limit login dan API; password mitra acak sekali tampil; password demo ditolak pada production. |
| Tinggi | Reset web memiliki akses sangat luas | Konfigurasi eksplisit, koneksi maintenance terpisah ke database lokal yang sama, verifikasi password sebelum kunci, backup wajib dan rate limit. Atas permintaan pemilik, reset juga dapat diaktifkan di production. |
| Sedang | Input angka, gambar dan tautan terlalu longgar | Batas panjang/ukuran/presisi, validasi URL/gambar, total finansial terbatas, constraints saldo stok dan kepemilikan relasi. |
| Sedang | Ekspor berpotensi memakai memori berlebihan | Maksimum 10.000 baris; permintaan lebih besar ditolak dan perlu dipersempit intervalnya. XML dibersihkan dari karakter kontrol. |
| Sedang | Respons/log dapat membocorkan informasi internal | Error server generik, redaksi token/kredensial, query string tidak dicatat, no-store dan header API. |
| Sedang | Runtime dapat mengubah/menghapus histori | Hak UPDATE/DELETE audit, histori status, dan mutasi stok dicabut; runtime tidak memiliki DDL. |
| Sedang | Kredensial demo tampak di build produksi | UI demo hanya development; seed ditolak di production; token browser tidak lagi persisten di localStorage. |

## Perubahan PostgreSQL lokal

- Backup format custom dibuat sebelum migrasi di `apps/api/backups/`. Backup mengandung data sensitif; jangan dibagikan atau disajikan melalui web.
- Migrasi `008_security_integrity.sql` diterapkan tanpa menghapus data operasional.
- Role `borneo_runtime` dibuat dengan kredensial acak; koneksi disimpan di `.env.runtime` yang diabaikan Git.
- Hak PUBLIC pada database aplikasi dan CREATE pada schema public dicabut. Tidak ada perubahan pada database aplikasi lain.
- Timeout koneksi/query/kunci ditambahkan untuk membatasi request yang menggantung.
- PostgreSQL lokal menggunakan autentikasi loopback SCRAM. Listener terdeteksi di seluruh interface, walaupun aturan `pg_hba.conf` yang diperiksa hanya mengizinkan loopback. Listener/firewall global belum diubah karena bisa digunakan aplikasi lain.

Constraints/trigger adalah pertahanan integritas tambahan, **bukan Row Level Security**. Runtime masih bisa membaca tabel aplikasi untuk melayani seluruh tenant. Isolasi baca tenant saat ini diterapkan di API; SQL injection atau kompromi proses API masih berisiko. Seluruh query input yang ditinjau memakai parameter SQL; identifier dinamis maintenance divalidasi/dikutip.

## Verifikasi

- `npm test`: 78 tes API lulus; frontend belum memiliki unit test.
- `npm run test:security`: 17 kelompok skenario lulus pada database PostgreSQL sementara dengan role runtime terbatas.
- Skenario mencakup akses tanpa login, eskalasi buyer, produk privat lintas-admin, isolasi dapur/laporan, checkout paralel, pengiriman/pembatalan ganda, konfirmasi dapur, berat aktual dan rollback stok kurang, approval barang luar katalog ganda, password mitra acak, pembatasan hak DB, penolakan reset, akun nonaktif, serta rate limit login.
- `npm run build`: API dan frontend berhasil dibangun.
- `npm audit`: 0 kerentanan dependensi yang dikenal saat pemeriksaan; bukan bukti tidak ada kerentanan baru.
- Migrasi dan backup lokal berhasil; restore backup ke lingkungan pemulihan belum diuji.

Tes integrasi membuat dan menghapus database unik `borneo_security_test_<uuid>`, bukan menghapus isi database operasional. Jika proses dibunuh paksa, periksa database sementara yang tertinggal sebelum menghapusnya secara manual.

## Menjalankan dan memelihara

### Development

Gunakan langkah README. Setelah hardening sesi, login ulang diperlukan. File `.env` lokal berisi akses maintenance; `.env.runtime` berisi akses API. Keduanya harus dibatasi dengan ACL Windows ke pengguna operator yang dipercaya. Mode file Unix 0600 saja tidak menjamin ACL Windows.

Backup: jalankan `npm run db:backup`. Jika `pg_dump` tidak ada di PATH, set `PG_DUMP_PATH` ke executable PostgreSQL yang sesuai. Simpan salinan terenkripsi di luar mesin, tentukan retensi, dan uji restore secara berkala pada database terpisah. Jangan menaruh backup di folder public/dist.

Reset tersedia untuk superadmin di development maupun production jika `ALLOW_DATA_RESET=true`, `DATA_RESET_DATABASE_URL` menunjuk database lokal yang sama, dan `PG_DUMP_PATH` valid. Restart API setelah mengubah konfigurasi. Tetap wajib password superadmin, teks persis `Ya, Saya Yakin Untuk Hapus Semua Data.`, dan backup sukses sebelum penghapusan. Koneksi reset memiliki hak lebih tinggi; simpan hanya sebagai secret server. Jangan gunakan koneksi tersebut sebagai DATABASE_URL runtime.

Production juga membutuhkan `DATA_RESET_BACKUP_DIR` absolut dan private di luar release.
Setup Ubuntu memakai role non-owner `borneo_cleanup`, file cleanup.env terpisah,
dan StateDirectory 0700. Langkah aktivasi satu kali ada di DEPLOYMENT.md; merge kode
saja tidak mengubah konfigurasi host existing. Tidak ada reset yang dijalankan saat deploy.
Superadmin boleh mereset password akun tanpa password lama; actor tetap divalidasi
dengan role aktif dan versi kredensial setelah lock. Admin dan buyer tetap memerlukan
password lama. Akun nonaktif dapat dihapus dari daftar oleh superadmin melalui
soft-delete permanen; constraint database menolak reaktivasi, histori/FK dipertahankan.

### Checklist sebelum VPS / data asli

1. Gunakan database production bersih, bukan database demo. Buat kredensial baru; jangan gunakan password yang pernah dibagikan di percakapan atau seed.
2. Jalankan `npm ci` dan build. Pada proses maintenance tersendiri, set `NODE_ENV=production` dan `MIGRATION_DATABASE_URL`, lalu jalankan `npm run db:migrate`.
3. Provision role runtime dengan hak minimum. `npm run db:secure` tersedia untuk PostgreSQL loopback yang role-nya belum ada; jangan menjalankannya untuk merotasi role existing. Tabel baru pada migrasi berikutnya perlu grant eksplisit setelah ditinjau, bukan default grant luas.
4. Pada database baru yang belum punya akun, set `BOOTSTRAP_EMAIL` dan `BOOTSTRAP_PASSWORD` unik (minimal 12 karakter, maksimal 72 byte), jalankan `npm run db:bootstrap` pada proses maintenance. Jangan jalankan `db:seed`.
5. Proses API hanya menerima DATABASE_URL runtime, JWT_SECRET acak minimal 48 karakter, NODE_ENV=production, WEB_ORIGIN HTTPS yang tepat, HOST=127.0.0.1. Jangan salin `.env` maintenance ke deployment atau membuatnya dapat dibaca user layanan API. Hapus variabel bootstrap/migrasi dari proses layanan. Jika fitur reset diperlukan, berikan DATA_RESET_DATABASE_URL sebagai secret terpisah dengan akses file terbatas.
6. Jalankan API sebagai user OS non-root; batasi direktori dan izin baca secret. Publikasikan **hanya** `apps/web/dist` lewat reverse proxy HTTPS, bukan root repository. API/port 4000 dan PostgreSQL/5432 tidak boleh terbuka ke internet.
7. Proxy harus menimpa X-Forwarded-For dari alamat klien, bukan mempercayai header klien. Set TRUST_PROXY=loopback hanya jika reverse proxy lokal adalah satu-satunya jalur publik. Untuk beberapa instance API, pakai penyimpanan rate limit bersama; limiter sekarang per proses.
8. Batasi listen_addresses PostgreSQL ke loopback jika satu VPS; gunakan firewall, SCRAM, dan TLS untuk database terpisah. Batasi maintenance login hanya ke operator.
9. Pasang CSP yang sesuai frontend, TLS/HSTS, monitoring error/authentication, backup terenkripsi, kebijakan retensi, pembaruan OS/dependensi, dan uji restore sebelum menerima data asli.

## Batas dan tindak lanjut

- Belum dilakukan penetration test eksternal, load test, pengujian seluruh UI, atau validasi konfigurasi VPS/HTTPS aktual.
- JWT masih dapat diakses JavaScript melalui sessionStorage: XSS tetap dapat mencuri sesi. Pertimbangkan sesi HttpOnly/Secure/SameSite dengan perlindungan CSRF untuk fase berikutnya; sessionStorage bukan pengganti pencegahan XSS.
- Logout menghapus token browser, tetapi token yang telah dicuri tetap berlaku hingga kedaluwarsa kecuali akun/role/password berubah. Belum ada daftar sesi dan pencabutan per perangkat.
- Belum ada MFA, workflow reset password mandiri, database RLS, atau audit append-only eksternal. Hak owner PostgreSQL tetap dapat mengubah histori: lindungi akun maintenance dan backup.
- Daftar operasional belum seluruhnya dipaginasi. Data besar perlu pagination, uji beban, dan monitoring; batas ekspor bukan solusi seluruh beban query.
- Kredensial lokal yang pernah dibagikan perlu dirotasi sebelum penggunaan asli. Audit ini tidak mengubah password owner PostgreSQL karena dapat memutus aplikasi lain.

Rujukan primer: [PostgreSQL privileges](https://www.postgresql.org/docs/16/ddl-priv.html), [Fastify rate-limit](https://github.com/fastify/fastify-rate-limit).
