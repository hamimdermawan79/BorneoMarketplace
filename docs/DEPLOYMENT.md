# Deployment Ubuntu 24 Dengan GitHub Dan Cloudflare

Status: template lokal sudah tersedia; belum dipasang atau diuji pada VPS. Deployment
GitHub sengaja tidak aktif sampai variabel repository `DEPLOY_ENABLED=true` dibuat.
VPS `43.173.36.58` dikonfirmasi kosong, dengan user operator `borneo` dan akses sudo.
Domain final, SSH key untuk automation, dan kapasitas mesin masih perlu dikonfirmasi.
Tidak ada konfigurasi Cloudflare atau GitHub yang diubah dari workspace ini.

Jalur publik menggunakan **Cloudflare Tunnel**, bukan A record langsung ke IP VPS.
Token tunnel yang pernah dibagikan harus dirotasi sebelum digunakan; token baru hanya
disimpan di VPS, tidak dalam repo, GitHub Actions, atau percakapan.

## Alur Update

```text
feature/* -> PR develop -> PR main -> Test And Build -> SSH -> VPS
                                                         |
                              Build Release -> Stop API -> Backup DB/Foto
                                                         |
                              Migrasi -> Switch Release -> Health Check
```

- `main` adalah kode production; perubahan masuk lewat pull request, bukan push langsung.
- `develop` adalah integrasi perubahan. CI memeriksa push dan PR ke `main`/`develop`.
- Workflow `.github/workflows/ci-deploy.yml` deploy otomatis hanya pada `main`, setelah test
  dan build sukses serta flag deploy aktif. `workflow_dispatch` bisa dipakai untuk redeploy
  commit terbaru `main`; pilih branch `main` ketika menjalankannya.
- Pasang branch protection/ruleset `main`: PR wajib, status `Test and Build` wajib,
  larangan force push/deletion. Pilihan protection bergantung paket/visibilitas repo.
  Jangan mengubah nama status wajib tanpa memperbarui rule. Review migration dan workflow
  sebagai kode sensitif. Jangan jalankan runner self-hosted di VPS production untuk PR.
- Workflow dan action dipin ke commit SHA; pembaruan action perlu ditinjau berkala.
- Workflow lama tidak boleh menimpa commit lebih baru: script mengecek HEAD `main`
  sebelum build dan sebelum cutover. Lock server mencegah deployment bersamaan.

## Struktur Repository Dan VPS

Tidak perlu memindah source aplikasi atau menggabungkan ulang repository:

```text
apps/api/                 API, migrasi, CLI maintenance
apps/web/                 frontend
.github/workflows/        CI dan deploy
deploy/ubuntu/            template service, Nginx, env, entry point deploy
docs/DEPLOYMENT.md         panduan operasional
```

Pada VPS:

```text
/opt/borneo-marketplace/
  repository.git/         bare Git repository, root-owned; read-only key ke GitHub
  releases/<sha>-<UTC>/    source dan build per release
  current -> releases/... release aktif; symlink diganti setelah build sukses
/etc/borneo-marketplace/
  runtime.env             hanya secret API runtime
  maintenance.env         hanya secret pemilik schema untuk migrasi
/etc/cloudflared/tunnel.token         token tunnel, root-owned 0600
/var/lib/borneo-marketplace/produk/    foto produk persistent, private
/var/backups/borneo-marketplace/      dump PostgreSQL dan arsip foto, private
```

Database dan storage **tidak berada di checkout/release**. Redeploy tidak menjalankan
seed, bootstrap, reset, atau menghapus data. File `.env`, dump, foto private, output
review, dan `node_modules` tidak diunggah ke GitHub.

## Persiapan VPS Sebelum Deployment Pertama

Template ini mengasumsikan satu VPS Ubuntu 24.04, PostgreSQL lokal, Nginx di host,
dan Node.js 24 tersedia pada `/usr/local/bin/node` (npm tersedia pada PATH).
Nginx hanya mendengarkan `127.0.0.1:8080`; cloudflared berjalan pada host yang sama.
Gunakan distribusi resmi Node.js dan verifikasi checksum; jangan menyalin node_modules
dari Windows. PostgreSQL 16 dari Ubuntu 24 sesuai kebutuhan aplikasi; `pg_dump` harus
sesuai major server. Periksa RAM/disk sebelum build (paket native Sharp perlu Linux).

1. Inventaris service, port, firewall dan data VPS. Jangan menimpa site, PostgreSQL,
   konfigurasi SSH, atau firewall layanan lain. Pastikan login SSH key operator bekerja
   sebelum menonaktifkan login password/root. Pertahankan sesi operator selama perubahan.
2. Buat user OS terpisah: `borneo-deploy` untuk SSH CI; `borneo-build` untuk npm/build;
   `borneo-api` untuk service; `borneo-maintenance` untuk CLI schema. Hanya user deploy
   perlu login SSH; sisanya tanpa login interaktif. User build/API/maintenance tidak punya sudo.
3. Buat `/opt/borneo-marketplace` dan `releases` root-owned 0755. Repo bare root-owned,
   origin `git@github.com:hamimdermawan79/BorneoMarketplace.git`. Gunakan SSH deploy key
   **read-only**, hanya untuk repo ini, pada akun root di VPS. Verifikasi host key GitHub
   dari dokumentasi resmi, bukan menerima fingerprint baru tanpa pemeriksaan.
   Ini berbeda dari key GitHub Actions -> VPS.
4. Buat database bersih `borneo_marketplace` dan pemilik schema non-superuser. Jangan
   menyalin database demo. Jika data lokal asli perlu dipindah, rencanakan migrasi DB
   **beserta foto private**, downtime, dan verifikasi restore dahulu.
5. Siapkan checkout bootstrap terpisah untuk install dependency dan CLI awal. Dengan
   credential maintenance pada proses tersendiri, jalankan `db:migrate`, `db:secure`,
   dan `db:bootstrap` sesuai README/SECURITY-AUDIT. `db:secure` memerlukan owner yang
   punya izin provisioning role; untuk akun owner tanpa CREATEROLE, provisioning
   satu kali memakai operator PostgreSQL yang berwenang, lalu cabut hak yang tak diperlukan.
   Jangan memberi credential ini ke API atau menjalankan `db:seed` production.
   Akun pertama menggunakan `BOOTSTRAP_USERNAME=borneoadminsbs` dan password baru
   yang dimasukkan langsung oleh operator. Email opsional; jangan menggunakan password
   yang pernah dibagikan di percakapan. Bootstrap tidak dijalankan ulang saat redeploy.
6. Pindahkan URL `borneo_runtime` hasil provisioning ke `runtime.env`; isi JWT acak
   minimal 48 karakter, WEB_ORIGIN HTTPS domain final, dan storage persistent. Pasang
   `runtime.env` root:borneo-api 0640, `maintenance.env` root:root 0600. Directory `/etc/borneo-marketplace`
   harus bisa dilalui user API (misalnya root:root 0755); file secret tetap terbatas.
   URL-encode password pada URL PostgreSQL. Jangan memasukkan secret ke commit/chat/log.
   Hapus credential bootstrap dari checkout sementara setelah disimpan aman.
7. Storage `/var/lib/borneo-marketplace/produk` dimiliki borneo-api:borneo-api, mode 0700;
   parent boleh 0755. Backup root:root 0700. Jangan beri Nginx akses foto privat.
8. Pasang `borneo-api.service` root-owned pada `/etc/systemd/system/`, jalankan
   `systemctl daemon-reload`. **Jangan start service sebelum symlink current tersedia.**
   Aktifkan service untuk boot setelah deployment pertama berhasil.
9. Pasang `borneo-deploy.sh` sebagai `/usr/local/sbin/borneo-deploy` root:root 0755.
   Jangan mengeksekusi script dari checkout yang writable oleh user deploy dengan sudo.
   Tambahkan sudoers melalui `visudo` dan validasi syntax:

   ```text
   borneo-deploy ALL=(root) NOPASSWD: /usr/local/sbin/borneo-deploy *
   ```

   Entry point menolak argumen selain satu SHA main 40 karakter. SSH key CI sebaiknya
   diberi opsi `restrict` pada authorized_keys, tanpa forwarding/PTY. Lindungi akun
   deploy seperti credential production: deploy kode tetap merupakan otoritas sensitif.
10. Pasang konfigurasi Nginx loopback dan hapus/nonaktifkan site default yang mendengarkan
    publik pada VPS kosong ini. Validasi `nginx -t` sebelum reload. Pasang cloudflared
    menggunakan apt resmi, rotasi token yang pernah dibagikan, dan simpan token baru
    root:root 0600 pada `/etc/cloudflared/tunnel.token`. Template `cloudflared.service`
    memakai `--token-file`, sehingga token tidak tercetak pada argumen process atau unit.
    Gunakan satu service saja; jangan menimpa service existing tanpa memeriksa kondisinya.
    Tambahkan hostname aplikasi pada tunnel dengan origin `http://127.0.0.1:8080`.
    Tambahkan CSP frontend setelah
    sumber gambar, font, dan iframe yang benar diverifikasi; jangan asal memasang CSP
    yang memutus fungsi aplikasi. API sudah memasang CSP/header-nya sendiri.
11. Jalankan deployment pertama dengan operator menggunakan SHA terbaru `main`:

    ```bash
    sudo /usr/local/sbin/borneo-deploy <SHA_MAIN_40_KARAKTER>
    sudo systemctl enable borneo-api
    sudo systemctl status borneo-api
    ```

    Placeholder bukan perintah siap-paste. Uji login superadmin, otorisasi admin/buyer,
    unggah dan akses foto, pesanan, laporan PDF, restart VPS, serta restore backup
    pada database terpisah sebelum mengaktifkan deploy otomatis/data asli.

## GitHub Secrets Dan Aktivasi

Pada repository, buat environment `production`, batasi deployment ke `main`.
Simpan secrets berikut pada environment tersebut:

| Nama | Isi |
|---|---|
| `VPS_HOST` | IP/hostname VPS untuk SSH, bukan hostname Cloudflare proxied |
| `VPS_PORT` | port SSH; kosong berarti 22 |
| `VPS_SSH_KEY` | private key khusus CI untuk login `borneo-deploy` |
| `VPS_KNOWN_HOSTS` | baris known_hosts sesuai host/port VPS, fingerprint diverifikasi melalui console provider/operator |

Untuk port non-22, entri known_hosts harus cocok dengan `[host]:port`. Jangan memakai
`StrictHostKeyChecking=no` atau menaruh key di repo. `ssh-keyscan` bisa mengumpulkan
key tetapi **tidak** membuktikan keasliannya: cocokkan fingerprint lewat saluran tepercaya.
Cloudflare token, JWT secret dan credential database tidak dibutuhkan dalam workflow.

Set **repository variable** (bukan secret atau environment variable) `DEPLOY_ENABLED=true`
sesudah deployment manual pertama lulus. Jangan mengaktifkan required approval pada
environment jika menginginkan auto-deploy tanpa klik; keamanan approval tetap melalui
PR `main`. Ketersediaan environment protection bergantung paket GitHub.

Konfigurasi baru saat ini belum di-commit/push. Review perubahan lalu commit **file
yang memang relevan**, bukan `git add .` tanpa memeriksa data sensitif.

## Cloudflare

1. Selesaikan nameserver, pastikan zone berstatus active; pertahankan record DNS email
   dan layanan lain. Pilih domain/subdomain aplikasi setelah mempertimbangkan layanan existing.
2. Gunakan tunnel yang telah dibuat pemilik. Di dashboard, rotasi token yang pernah
   dibagikan dan force-disconnect koneksi lama jika ada connector tidak dikenal.
   Rotasi saja tidak memutus koneksi lama yang sudah terhubung. Simpan token pengganti
   hanya di VPS. Jangan masukkan token ke argumen command yang akan disalin ke chat.
3. Tambahkan published hostname aplikasi dengan service type HTTP dan URL
   `127.0.0.1:8080`. Cloudflare membuat routing DNS tunnel; jangan membuat A/AAAA
   hostname aplikasi ke IP VPS bersamaan dengan routing tunnel. Pertahankan DNS layanan lain.
   Domain belum diberikan; jangan menerbitkan hostname sebelum pemilik mengonfirmasi.
4. Browser memakai HTTPS pada edge Cloudflare; connector memakai encrypted tunnel,
   lalu HTTP loopback ke Nginx. Sertifikat Origin CA tidak diperlukan untuk hop loopback
   ini. Jangan mengubah SSL zone ke Flexible. Jika kelak pindah ke origin HTTPS langsung,
   gunakan certificate valid dan Full (strict); konfigurasi itu berbeda dari Tunnel.
5. Cache Rule untuk hostname aplikasi dan path `/api/*`: **Bypass cache**. Jangan cache
   API, login, gambar privat, atau laporan. Jangan memasang Cache Everything untuk app.
   HTML harus revalidate agar release baru terbaca; cache asset branding singkat.
6. Template Nginx hanya menerima trafik dari connector lokal dan mempercayai
   CF-Connecting-IP dari `127.0.0.1`. Jangan ubah listener menjadi publik tanpa
   mengganti trust model. X-Forwarded-For diteruskan sebagai IP klien tervalidasi.
7. Jalur masuk publik cukup SSH untuk operator/CI; port 80/443/8080/4000/5432 tidak
   perlu dibuka untuk aplikasi Tunnel. Izinkan egress cloudflared sesuai dokumentasi
   provider/Cloudflare. Jangan mengaktifkan firewall sebelum jalur SSH dikonfirmasi.
   GitHub hosted runner tidak punya satu IP statis; jangan mengunci SSH ke satu IP
   runner sementara. Pilih akses SSH yang terkontrol sebelum aktivasi automation.
8. Uji HTTPS publik, callback origin, IP rate-limit, cache dan endpoint privat setelah
   DNS aktif. Cloudflare bukan pengganti autentikasi tenant, backup, atau keamanan VPS.

## Update Migrasi Dan Recovery

- Build gagal: release aktif tidak disentuh. Build sukses: API dihentikan sebentar,
  DB + foto dibackup, migrasi dijalankan, symlink diganti, API dinyalakan, health dicek.
  Alur ini **memiliki downtime**, bukan zero-downtime/blue-green.
- Backup konsisten mengasumsikan tidak ada writer selain API. Hentikan writer lain
  sebelum deploy. Salinan backup lokal bukan disaster recovery: simpan salinan
  terenkripsi offsite, tetapkan retensi, dan uji restore. Release/backup tidak otomatis
  dihapus agar recovery tersedia; monitor disk dan tetapkan cleanup terkontrol.
- Script bukan perintah rollback manual: SHA yang bukan HEAD main ditolak/dilewati.
  Untuk rollback normal, revert via PR ke main agar menjadi release baru yang diaudit.
- Jika health check gagal, script menghentikan versi gagal dan mengembalikan kode
  sebelumnya bila ada. Schema DB **tidak otomatis di-downgrade**. Migrasi harus
  backward-compatible (expand/contract), transaksi tidak membatalkan migrasi yang
  sudah sukses pada file sebelumnya. Restore DB bisa kehilangan transaksi setelah
  snapshot; jangan melakukannya tanpa menilai dampak.
- Migrasi tabel baru harus memberi grant runtime yang ditinjau. Jangan menjadikan
  runtime superuser atau default-grant semua tabel. CLI secure bukan perintah update
  setiap deploy. Perubahan service/Nginx/script privileged dipasang ulang oleh operator
  setelah review; deployment source tidak menimpa konfigurasi host secara otomatis.
- Health check adalah koneksi database/API, bukan pemeriksaan seluruh skema/fungsi.
  Pantau `journalctl -u borneo-api`, test akses HTTPS dan smoke test bisnis setelah release.

## Referensi Resmi

- [GitHub workflow triggers](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [GitHub environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [GitHub SSH fingerprints](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)
- [Node.js releases](https://nodejs.org/en/about/previous-releases)
- [Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/)
- [Cloudflare Origin CA](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/)
- [Cloudflare Tunnel token rotation](https://developers.cloudflare.com/tunnel/reference/tunnel-tokens/)
- [Cloudflare Tunnel token file](https://developers.cloudflare.com/tunnel/reference/run-parameters/#token-file)
- [Cloudflare apt repository](https://pkg.cloudflare.com/)
- [Cloudflare cache rules](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/)
- [Cloudflare trusted IPs](https://www.cloudflare.com/ips/)
- [Nginx proxy headers](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header)
