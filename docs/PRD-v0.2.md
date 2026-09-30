# PRD v0.2 — Borneo Marketplace

## Tujuan

Borneo Marketplace adalah sistem pengadaan tertutup milik Koperasi Borneo Mandiri. Sistem menghubungkan admin koperasi dengan dapur mitra, memisahkan tanggung jawab per cluster, membantu penyiapan barang berdasarkan sumber stok, dan menghasilkan laporan operasional maupun keuangan. Sistem tidak menangani pembayaran.

## Role dan cakupan data

### Superadmin

- melihat seluruh admin, dapur, produk, pesanan, dan laporan;
- membuat dan mengaktifkan/nonaktifkan master produk global;
- mengatur akun, role, serta relasi admin–dapur;
- melakukan pengawasan lintas cluster.

### Admin koperasi

- hanya melihat dapur yang ditugaskan kepadanya;
- melihat produk yang tersedia, menentukan harga jual, dan memasukkan stok;
- memproses pesanan dapur dalam clusternya;
- mengisi berat aktual untuk telur dan ayam serta mengunduh laporan cluster.

### Buyer / dapur

- hanya melihat katalog, harga, dan ketersediaan milik admin pengelolanya;
- membuat dan memantau pesanan dapurnya sendiri;
- mengonfirmasi barang diterima.

## Model produk dan stok

`Produk Pokok` adalah data global berisi SKU, nama, kategori, gambar, satuan pesan, satuan harga, dan aturan timbang. Produk Pokok dikelola Superadmin dan tersedia sebagai pilihan untuk seluruh Admin Koperasi. Nama, satuan, dan gambarnya seragam.

Admin juga dapat membuat produk tambahan saat mencatat stok. Admin mengisi nama, kategori, satuan, dan mengunggah gambar yang dapat diposisikan serta dipotong menjadi rasio 1:1. Produk tambahan hanya tersedia pada cluster Admin pembuatnya dan tidak masuk ke Produk Pokok Superadmin maupun cluster Admin lain.

Setiap stok masuk disimpan sebagai batch dan wajib memiliki sumber:

- `COOPERATIVE`: sumber default untuk barang milik koperasi;
- `VENDOR`: barang harus disediakan dari vendor tertentu.

Halaman stok Admin hanya menampilkan daftar persediaan dan satu aksi `Tambah stok`. Nama vendor hanya diminta ketika sumber `VENDOR` dipilih. Sistem menampilkan saran vendor yang pernah digunakan; nama baru otomatis disimpan saat stok dicatat. Harga beli vendor tidak diminta. Tabel persediaan menampilkan kuantitas koperasi, vendor, dan total secara terpisah.

Stok dan harga terisolasi per admin. Dapur otomatis mewarisi katalog admin yang mengelolanya. Satu produk dapat memiliki beberapa batch dan beberapa sumber.

## Alokasi dan penyiapan barang

Saat checkout, sistem mereservasi stok secara transaksional. Prioritas alokasi saat ini adalah stok koperasi lebih dahulu, lalu vendor berdasarkan waktu penerimaan batch. Bila satu sumber tidak cukup, satu item dapat terbagi menjadi beberapa alokasi.

Pada layar admin, daftar penyiapan dikelompokkan menjadi:

1. barang dari koperasi;
2. barang dari vendor, disertai nama vendor.

Checklist diterapkan pada setiap alokasi, bukan hanya pada nama produk. Pesanan tidak dapat dikirim sebelum seluruh alokasi dicentang dan semua berat aktual wajib telah diisi.

## Aturan telur dan ayam

| Produk | Satuan dipesan | Satuan harga/stok | Saat checkout | Saat pengiriman |
|---|---|---|---|---|
| Telur | pcs | kg | tampil estimasi kg dan harga | admin wajib mengisi kg aktual |
| Ayam | potong | kg | tampil estimasi kg dan harga | admin wajib mengisi kg aktual |

Berat aktual menjadi dasar nilai final. Saat jumlah aktual berbeda dari estimasi, sistem melepaskan sisa reservasi atau mengambil tambahan stok secara transaksional. Pengiriman ditolak jika stok tambahan tidak mencukupi.

## Status pesanan

```text
SUBMITTED → PREPARING → SHIPPED → AWAITING_KITCHEN → COMPLETED
```

- dapur dapat membatalkan hanya saat `SUBMITTED`;
- admin dapat membatalkan sebelum barang dikirim;
- admin menandai pengiriman selesai sehingga status menjadi `AWAITING_KITCHEN`;
- dapur menjadi satu-satunya pihak yang mengonfirmasi status akhir `COMPLETED`.

## Laporan

- PDF: laporan operasional yang dapat memuat identitas pesanan, dapur, item, kuantitas, sumber, dan nilai;
- Excel: tabel keuangan saja, untuk pengolahan lebih lanjut;
- nilai final memakai berat aktual bila produk ditimbang;
- laporan keuangan berfokus pada nilai penjualan; harga beli vendor tidak menjadi input operasional.

## Kriteria penerimaan inti

- Admin A tidak dapat melihat atau mengubah data Admin B/C.
- Dapur hanya melihat produk admin yang ditugaskan kepadanya.
- Checkout gagal seluruhnya bila salah satu stok item tidak cukup.
- Barang yang sama dari dua sumber muncul pada dua kelompok penyiapan dan memiliki checklist terpisah.
- Telur/ayam tidak dapat dikirim sebelum berat aktual diisi.
- Pesanan selesai tidak muncul sebagai pekerjaan aktif.
- Pembatalan melepaskan seluruh reservasi stok.
- Kredensial database tidak tersimpan di Git.

## Fase berikutnya

1. Riwayat stok, koreksi stok, dan stock opname.
2. Penyempurnaan audit trail operasional di luar aktivitas manajerial.
4. Filter periode serta rekap margin pada laporan.
5. Notifikasi WhatsApp opsional dan PWA/Android wrapper setelah alur produksi stabil.
