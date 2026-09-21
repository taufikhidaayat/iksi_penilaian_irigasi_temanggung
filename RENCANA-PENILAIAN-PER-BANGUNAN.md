# Rencana: Penilaian per Bangunan

Status: **SELESAI dan aktif.** Dikerjakan 15 September 2026, identitas
bangunan dan tampilan pengisiannya diperbaiki 18 September 2026 (bagian 12
dan 13). Migrasi 0009 sudah dijalankan ke Supabase dan terverifikasi. Sisa
pekerjaan ada di bagian 14.

Mengubah cara Komponen I dinilai, dari satu angka untuk seluruh jaringan
menjadi satu angka per bangunan yang kemudian dirata-rata, seperti blangko
Permen PUPR 12/PRT/M/2015.

---

## 1. Kenapa berubah

Asumsi lama tertulis di `panel-aset-di.tsx` baris 122-126: "satu nilai untuk
tiap indikator, bukan satu nilai per bangunan". Asumsi itu **salah**. Blangko
sumber memeriksa tiap bangunan satu per satu, lalu merekapnya. D.I. dengan 41
bangunan sadap berarti 41 baris pemeriksaan, bukan satu.

Catatan di `PROGRESS.md` bagian "Jumlah aset per D.I." yang menyimpulkan
"IKSI tidak menilai per unit" ikut dikoreksi saat rencana ini dikerjakan.

## 2. Kunci: rata-rata tidak mengubah mesin hitung

Dua urutan perhitungan ini menghasilkan angka yang **identik**, bukan sekadar
mendekati:

- **Cara blangko**: hitung nilai tiap bangunan (indikator dikali bobotnya),
  lalu rata-ratakan nilai seluruh bangunan.
- **Cara sistem**: rata-ratakan tiap indikator lintas bangunan, lalu kalikan
  bobotnya.

Sebabnya rata-rata itu operasi linear:

```
rata-rata( Σ bobotᵢ × nilaiᵢⱼ )  =  Σ bobotᵢ × rata-rata( nilaiᵢⱼ )
     j                                              j
```

Konsekuensinya besar: `hitungSkor()` di `src/lib/iksi/scoring.ts`, katalog 270
node, rekap, ekspor Excel, dan 53 test yang sudah hijau **tidak perlu disentuh
sama sekali**. Yang berubah hanya asal-usul angka yang masuk ke daun, dari
ketikan manual menjadi hasil rata-rata.

**Syarat berlakunya:** semua bangunan terisi lengkap. Begitu ada yang kosong,
kedua urutan mulai berbeda. Lihat aturan di bagian 5.

## 3. Pemetaan jenis aset ke indikator

**58** dari 158 indikator input menjadi per bangunan. 100 sisanya tetap agregat.

| Jenis aset | Kelompok indikator | Indikator/unit |
|---|---|---:|
| `bendung` | I.1.1-1 Bendung | 21 |
| | I.1.1-2 Pintu-pintu bendung | 4 |
| | I.1.1-3 Kantong lumpur (hanya bila D.I. punya) | 5 |
| | I.3.3-2.a Pengukuran debit bangunan pengambilan | 3 |
| `sadap` | I.3.3-1.a Bangunan induk dan sekunder | 6 |
| | I.3.3-2.b Bangunan pengukur | 3 |
| `saluran` | I.2.2-1 Kapasitas saluran | 3 |
| | I.2.2-2 Tanggul | 2 |
| `bangunan_pengaman` | I.2.2-2 Tanggul (menyatu dengan saluran) | 2 |
| `talang` | I.3.3-3.a.a-1 Syphon, gorong-gorong, talang, cross drain | 6 atau 7 |
| `gorong_gorong` | I.3.3-3.a.a-1 (sama) | 6 atau 7 |
| `terjunan` | I.3.3-3.a.a-3 Terjunan, pelimpah samping, drain inlet | 4 |
| `saluran_pelimpah` | I.3.3-3.a.a-3 (sama) | 4 |

Jumlah per unit tidak selalu tetap, karena toggle kantong lumpur mengubah bobot
18 node:

- **Bendung**: 33 indikator bila D.I. punya kantong lumpur, 28 bila tidak.
- **Talang dan gorong-gorong**: 6 bila punya, **7** bila tidak. Penyebabnya
  I.3.3-3.a.a-1.ii "Fasilitas penguras berfungsi", yang berbobot 0 justru saat
  kantong lumpur ADA. Letaknya jauh dari sub-pohon kantong lumpur sehingga
  gampang terlewat. `indikatorUntukAset()` menyaringnya lewat `isRelevan()`,
  dan ada test khusus untuk ini.

Tanggul dipakai bersama oleh `saluran` dan `bangunan_pengaman` dengan sengaja.
Banyak D.I. punya salah satunya saja, dan aturan "rata-rata dari yang terisi"
membuat keduanya bisa menyumbang tanpa saling mengunci.

### Tingkat jaringan: tidak perlu kolom baru

**Sudah diverifikasi ke seluruh 9.996 aset bangunan (15 September 2026).**
Register aset hanya memuat jaringan induk dan sekunder:

- Seluruh **3.115** bangunan sadap bernomenklatur `SdpBg.S.####`. Segmen
  tingkatnya `S` semua, tanpa satu pun variasi.
- Seluruh **4.642** saluran bernama "Saluran Sekunder", satu-satunya nilai pada
  kolom `nama`.

Ini masuk akal: jaringan tersier bukan aset yang diinventarisasi pemerintah
daerah, melainkan tanggung jawab P3A. Konsekuensinya:

- **Kolom `aset.tingkat` dibatalkan.** Tidak ada yang bisa diisi olehnya.
- Seluruh aset `sadap` memetakan ke I.3.3-1.a dan I.3.3-2.b.
- **I.3.3-1.b** (Bangunan tersier) dan **I.3.3-2.c** (Sadap tersier) tetap
  agregat, karena memang tidak punya aset padanan. Keduanya tetap wajib diisi
  manual seperti sekarang.

> **Belum diputuskan:** 515 dari 3.115 sadap bernama "CORONG" atau "CORONGAN".
> Corongan di lapangan lazimnya bangunan sadap tersier. Kalau benar demikian,
> 515 aset itu semestinya masuk ke I.3.3-1.b, bukan I.3.3-1.a. Perlu
> dipastikan ke petugas lapangan sebelum pemetaan dikunci. Sebelum ada
> kepastian, seluruh sadap diperlakukan sebagai induk/sekunder.

### Tetap agregat

Bukan karena malas, tetapi karena deskriptornya memang bicara jaringan atau
program, bukan satu bangunan:

- **I.2.2-3 Pelaksanaan** dan **I.3.3-4 Perbaikan Bangunan**: isinya progres
  pekerjaan ("<60%", "60-79%"), sudah berbentuk rekap.
- **I.3.3-3.b Penyumbatan**: prosentase aliran air se-jaringan.
- **I.3.3-3.a.a-2 Jembatan** dan **I.3.3-3.a.a-4 Tangga cucian**: tidak punya
  padanan jenis di register aset.
- **I.4 Saluran Pembuang**: seluruh daunnya progres pembangunan/perbaikan,
  ditambah luas genangan banjir.
- **I.5 Jalan** dan **I.6 Kantor/Perumahan/Gudang**: prosentase kerusakan.
- **Komponen II sampai VI**: memang bukan objek per unit.

## 4. Yang perlu dibangun

### 4.1 Basis data

Migrasi `0009_penilaian_aset.sql` berisi dua hal:

```sql
-- 1. Melebarkan kolom nilai, karena rata-rata hampir selalu pecahan.
alter table penilaian_nilai
  alter column nilai type numeric(6, 3) using nilai::numeric;

-- 2. Tabel nilai per bangunan.
create table penilaian_aset_nilai (
  penilaian_id   uuid     not null references penilaian (id) on delete cascade,
  aset_id        bigint   not null references aset (id) on delete cascade,
  indikator_kode text     not null references indikator (kode) on delete restrict,
  nilai          smallint not null check (nilai between 0 and 100),
  massal         boolean  not null default false,
  primary key (penilaian_id, aset_id, indikator_kode)
);
create index on penilaian_aset_nilai (penilaian_id, indikator_kode);
```

Kolom `massal` membedakan nilai yang diperiksa satu per satu dari yang datang
lewat pengisian massal. Tanpa itu, D.I. yang seluruh bangunannya diisi sekali
klik tidak bisa dibedakan dari yang diperiksa sungguhan.

RLS mengikuti pola `penilaian_nilai` yang sudah ada: UPT hanya boleh menyentuh
baris milik penilaian di wilayahnya.

Sudah divalidasi dengan menjalankannya di dalam transaksi lalu di-rollback:
SQL sah, tipe kolom dan kedua policy terbentuk seperti yang diharapkan, dan
database tidak berubah.

Tidak ada perubahan lain pada tabel `aset`. Rencana awal menambahkan kolom
`tingkat` dibatalkan setelah verifikasi data, lihat bagian 3.

### 4.2 Modul pemetaan

Berkas baru `src/lib/iksi/per-bangunan.ts`, murni tanpa impor server:

- `KELOMPOK_PER_JENIS: Record<JenisAset, KelompokIndikator[]>` sesuai tabel
  bagian 3.
- `indikatorUntukAset(aset, kantongLumpur)` mengembalikan daftar kode daun yang
  harus diisi untuk satu aset, sudah memperhitungkan toggle kantong lumpur.
- `rataRataPerIndikator(nilaiAset)` mengubah nilai per aset menjadi
  `NilaiInput` biasa yang siap disuap ke `hitungSkor()`.

Ditest terpisah, termasuk pembuktian bahwa rata-rata per indikator sama dengan
rata-rata per bangunan pada data acak.

### 4.3 Server Action

`src/app/(app)/penilaian/actions.ts` saat simpan:

1. Tulis nilai per aset ke `penilaian_aset_nilai`.
2. Hitung rata-rata per indikator.
3. **Tetap tulis hasilnya ke `penilaian_nilai` seperti sekarang**, lalu jalankan
   `hitungSkor()` seperti biasa.

Langkah 3 yang membuat rekap, ekspor, dan dasbor tidak tahu ada perubahan.
Daun agregat tetap ditulis langsung dari input manual seperti sekarang.

### 4.4 Tampilan

- Daun per-unit berubah dari satu kartu 4-deskriptor menjadi satu tabel:
  baris = bangunan, kolom = indikator. Deskriptor kondisi pindah ke kepala
  kolom sebagai tooltip.
- **Tombol "samakan semua" wajib ada.** Lihat bagian 6.
- `PanelAsetDi` berubah peran, dari konteks pasif menjadi daftar kerja dengan
  penanda sudah/belum dinilai per bangunan. Catatan di baris 122-126 dihapus.
- Bilah progres menghitung bangunan, bukan hanya indikator.

## 5. Aturan bangunan yang belum dinilai

Diputuskan: **rata-rata diambil dari bangunan yang terisi saja.**

- Satu indikator bernilai `null` bila tidak ada satu pun bangunan yang
  mengisinya. `hitungSkor()` sudah menangani `null` dengan benar.
- Form menampilkan hitungan terang-terangan, misalnya "32 dari 41 sadap sudah
  dinilai", tetapi tidak memblokir tombol Ajukan.
- Angka ini ikut disimpan supaya verifikator Administrator bisa melihat seberapa
  lengkap dasar penilaiannya sebelum menyetujui.

Alasan tidak memakai 0 untuk yang kosong: "belum dinilai" dan "kondisinya
hancur" akan jadi tidak terbedakan, dan skor D.I. anjlok karena alasan
administratif belaka.

## 6. Beban pengisian, dan kenapa "samakan semua" bukan fitur tambahan

Diukur dari data sungguhan, 15 September 2026.

| Jenis | Total | Tanpa D.I. | D.I. punya | Rata²/D.I. | Maks | Indikator/unit |
|---|---:|---:|---:|---:|---:|---:|
| Saluran | 4.642 | 94 | 348 | 13,1 | **987** | 5 |
| Sadap | 3.115 | 125 | 416 | 7,2 | 68 | 9 |
| Bendung | 592 | 8 | 574 | 1,0 | 2 | 33 |
| Gorong-gorong | 556 | 12 | 191 | 2,8 | 93 | 6 |
| Saluran pelimpah | 526 | 70 | 245 | 1,9 | 12 | 4 |
| Terjunan | 513 | 0 | 127 | 4,0 | 43 | 4 |
| Talang | 50 | 0 | 37 | 1,4 | 4 | 6 |
| Bangunan pengaman | 28 | 0 | 13 | 2,2 | 8 | 2 |

> Angka Bendung diukur ulang 21 September 2026, setelah datanya diganti dari
> berkas GIS `SDY bendung Kab.dbf` (566 menjadi 592 baris). Beban pengisiannya
> justru turun: bendung tanpa D.I. tinggal 8 dari sebelumnya 15, dan satu D.I.
> paling banyak punya 2 bendung, bukan 6. Jenis lainnya belum berubah.
Beban isian gabungan per D.I. per triwulan, dihitung dengan asumsi kantong
lumpur ada (bawaan skema):

| | Isian |
|---|---:|
| D.I. punya aset bangunan | 541 dari 577 |
| Median | **101** |
| Rata-rata | 139 |
| D.I. dengan 50 isian atau kurang | 112 (21%) |
| Terberat | **5.197** |
| Terberat kedua | 1.328 |
| Total se-kabupaten | 75.329 |

**Ini jauh lebih ringan dari dugaan awal.** Separuh D.I. cukup sekitar 100
isian, dan itu pun sebagian besar bisa diselesaikan lewat pengisian massal.
Yang ekstrem hanya satu D.I. dengan 987 ruas saluran, dan jaraknya jauh dari
peringkat kedua. Kalau nanti terbukti menyiksa, D.I. itu saja yang dicarikan
jalan keluar, bukan seluruh rancangan yang dikorbankan.

Meski begitu, pengisian massal tetap wajib. Tanpa itu datanya akan diisi asal
supaya cepat selesai, yang justru lebih buruk daripada penilaian agregat.

Karena itu alur pengisiannya:

1. Petugas menetapkan satu nilai untuk seluruh bangunan sejenis sekaligus.
2. Lalu mengubah hanya bangunan yang menyimpang dari nilai itu.
3. Bangunan yang diubah manual diberi penanda, supaya terlihat mana yang benar
   benar diperiksa dan mana yang ikut nilai massal.

Penanda di langkah 3 penting untuk verifikasi: tanpa itu, D.I. yang semua
bangunannya diisi sekali klik tidak bisa dibedakan dari yang diperiksa
sungguhan.

## 7. Aset yang tidak tertaut D.I.

**316 aset bangunan tidak punya `di_id`** dan karena itu tidak akan muncul di
form penilaian mana pun: 125 sadap, 94 saluran, 70 saluran pelimpah, 15
bendung, 12 gorong-gorong.

Ini bukan penghalang rencana ini, tetapi jadi lebih mendesak setelahnya. Dulu
aset yatim cuma membuat daftar konteks kurang lengkap. Sekarang aset yatim
berarti bangunan yang **tidak pernah dinilai sama sekali**. Perapiannya sudah
ada di daftar "Yang BELUM" pada `PROGRESS.md`, terkait kode D.I. `9000` dan
`0831` yang tidak dikenal master.

## 8. Urutan kerja

1. ~~Verifikasi pola tingkat jaringan pada nomenklatur aset.~~ **Selesai
   15 September 2026.** Hasilnya: kolom `tingkat` tidak diperlukan, lihat
   bagian 3.
2. ~~Migrasi `0009_penilaian_aset.sql`.~~ **Ditulis 15 September 2026**, belum
   dijalankan ke Supabase.
3. ~~`src/lib/iksi/per-bangunan.ts` beserta testnya.~~ **Selesai
   15 September 2026.** 27 test, termasuk pembuktian kesetaraan dengan cara
   blangko pada 1 sampai 68 bangunan. Seluruh suite hijau: 101 test.
4. ~~Server Action: simpan per aset, rata-rata, tulis ke `penilaian_nilai`.~~
   **Selesai 15 September 2026.** Ikut memperbaiki dua bug yang ditemukan di
   jalan, lihat bagian 10.
5. ~~Tampilan per bangunan plus pengisian massal.~~ **Selesai
   15 September 2026.** Bentuknya bukan tabel, melainkan pilih bangunan lalu
   isi formnya, lihat bagian 11.
6. ~~`PanelAsetDi` jadi daftar kerja.~~ Digantikan tab **Per Bangunan** yang
   memang sudah berperan sebagai daftar kerja. `PanelAsetDi` tetap ada sebagai
   gambaran isi register, dan catatannya yang keliru sudah diganti.
7. Perbarui `PROGRESS.md`: koreksi bagian "Jumlah aset per D.I." dan keputusan
   desain yang menyebut penilaian agregat.

Langkah 2 dan 3 tidak mengubah apa pun yang sudah jalan, jadi aman dikerjakan
lebih dulu dan diuji sendiri.

## 9. Koreksi angka untuk `PROGRESS.md`

Hitungan di `PROGRESS.md` sudah bergeser dari data sekarang, kemungkinan karena
perapian lewat halaman Aset:

| | PROGRESS.md | Sekarang |
|---|---:|---:|
| Sadap, total | 3.036 | 3.115 |
| Sadap, D.I. punya | 419 | 416 |
| Saluran, D.I. punya | 353 | 348 |
| Bendung, D.I. punya | 536 | 532 |

Bendung total (566) dan saluran total (4.642) tidak berubah.

## 10. Temuan saat mengerjakan langkah 4

### Batas 1000 baris PostgREST, dua tempat

`ambilAsetPerDi()` memakai `.limit(2000)` dan **diam-diam terpotong di 1000**.
`max-rows` pada Supabase bernilai 1000, dan `limit` di atas angka itu tidak
menaikkannya. D.I. `33230275` punya 1.039 aset, jadi 39 di antaranya tidak
pernah sampai ke browser.

Selama panel aset cuma konteks, akibatnya sekadar daftar kurang lengkap.
Setelah perubahan ini, akibatnya 39 bangunan **tidak akan pernah bisa dinilai**
dan diam-diam tidak ikut dirata-ratakan. Sekarang ketiga tempat yang membaca
data berjumlah besar menarik per halaman sampai habis: `ambilAsetPerDi()`,
`ambilNilaiAset()`, dan `ambilJenisAset()` di Server Action.

Paginasinya memakai `id` sebagai pengurut terakhir. Tanpa pengurut yang unik,
`range()` bisa melewati atau menggandakan baris saat ada nilai kembar, dan
`nomenklatur` memang tidak unik.

### `penilaian_nilai.nilai` harus dilebarkan

Kolomnya `smallint`, padahal rata-rata hampir selalu pecahan. Membulatkannya
membuat baris di tabel itu tidak lagi cocok dengan `penilaian.total` yang
dibekukan, karena total dihitung dari angka penuh. Migrasi 0009 melebarkannya
ke `numeric(6, 3)`. Kolom `penilaian_aset_nilai.nilai` tetap `smallint`, karena
nilai per bangunan memang bilangan bulat 0..100.

### Membedakan "tidak dikirim" dari "dikirim kosong"

`simpanPenilaian` hanya menyentuh `penilaian_aset_nilai` bila pemanggil benar
benar mengirim `nilaiAset`. Array kosong berarti "hapus semua", sedangkan tidak
mengirim sama sekali berarti "jangan sentuh, baca saja yang tersimpan untuk
menghitung skor".

Tanpa pembedaan itu, satu penyimpanan dari bagian form yang belum tahu soal
penilaian per bangunan akan memusnahkan ribuan baris pemeriksaan tanpa ada yang
memintanya.

### Nilai per bangunan wajib disaring di server

Server memeriksa bahwa tiap `asetId` memang milik D.I. yang sedang dinilai, dan
bahwa indikatornya berlaku bagi jenis bangunan itu. Kiriman klien untuk
indikator per unit pada `nilai` biasa juga dibuang seluruhnya.

Ini meneruskan keputusan desain yang sudah ada: skor dihitung ulang di server
supaya tidak bisa dimanipulasi dari browser. Tanpa penyaringan ini, klien yang
dimodifikasi bisa mengarang id aset atau memasang indikator bendung pada sebuah
gorong-gorong.

Daftar indikator yang sah dihitung sekali per jenis, bukan per baris. D.I.
terberat mengirim ribuan baris.

## 11. Bentuk tampilan yang dipilih

Bukan tabel bangunan × indikator, melainkan **pilih satu bangunan lalu isi
formnya**, dengan progres yang kelihatan dan indikator yang menyesuaikan jenis.

Tab baru **Per Bangunan** duduk tepat setelah Prasarana Fisik, karena isinya
memang bagian dari komponen itu, hanya diisi dengan cara berbeda. Susunannya:

1. **Baris jenis** dengan hitungan tuntas, mis. "Bangunan Sadap 12/41".
   Bercentang bila seluruh bangunan jenis itu sudah selesai.
2. **Daftar bangunan** jenis terpilih, tiap baris berlencana Selesai, `3/9`,
   atau Belum. Ada pencarian dan paginasi 40 baris, dipakai begitu jumlahnya
   lewat satu halaman. Tanpa itu, D.I. dengan 987 ruas saluran akan merender
   987 baris sekaligus.
3. **Form bangunan terpilih**, memakai kartu 4-deskriptor yang sudah ada, jadi
   cara mengisinya sama persis dengan yang sudah dikenal penilai. Indikatornya
   dikelompokkan sesuai kelompok di katalog, dan hanya yang berlaku bagi jenis
   itu yang muncul.
4. **Sebelumnya / Berikutnya** untuk berpindah tanpa balik ke daftar.
5. **Salin ke semua**, pengisian massal yang menyalin nilai bangunan terbuka ke
   seluruh bangunan sejenis.

### Yang sengaja tidak ditimpa oleh pengisian massal

Bangunan yang sudah diperiksa satu per satu **tidak** ikut tertimpa. Pengisian
massal itu jalan pintas untuk bangunan yang belum disentuh, bukan alat untuk
menghapus hasil pemeriksaan yang sudah dikerjakan. Yang dicatat pada kolom
`massal` adalah cara mengisinya, bukan angkanya, sehingga mengisi tangan dengan
angka yang kebetulan sama tetap tercatat sebagai pemeriksaan sungguhan.

### Kartu penunjuk di tab Prasarana Fisik

Sepuluh kelompok yang pindah ke penilaian per bangunan tidak lagi dirender
sebagai kartu indikator di tab Prasarana Fisik. Di tempatnya ada kartu penunjuk
yang menyebut nilai rata-rata yang sudah terbentuk, berapa bangunan yang sudah
dinilai, dan tombol yang melompat ke tab Per Bangunan pada jenis yang tepat.

Tanpa itu, penilai akan mengisi kartu yang angkanya justru dibuang server.

### Autosave tidak mengirim ribuan baris tiap dua detik

Nilai per bangunan hanya ikut terkirim bila memang berubah, memanfaatkan
pembedaan "tidak dikirim" dari bagian 10. Mengubah satu indikator agregat pada
D.I. dengan 5.197 baris tidak lagi menyeret seluruh baris itu ikut naik.

Skor di layar dihitung lewat `gabungNilai()`, jalur yang sama persis dengan
yang dipakai server, supaya angka yang dilihat penilai tidak pernah berbeda
dari yang tersimpan.

## 12. Identitas bangunan di daftar kerja (18 September 2026)

Bentuk tampilan di bagian 11 sudah jalan, tetapi audit menemukan daftarnya
belum cukup untuk memastikan bangunan mana yang sedang dinilai. Baris daftar
dulu memuat nomenklatur, nama, dan desa saja — padahal **seluruh 4.642 saluran
bernama sama persis** ("Saluran Sekunder"), dan pada D.I. yang salurannya satu
desa, tidak ada lagi yang membedakan.

Yang diperbaiki:

1. `ambilAsetPerDi()` ikut membawa `kecamatan`, `bangunan_hulu`,
   `bangunan_hilir`, `nama_di_buku`, dan `perlu_tinjau`. Kolomnya sudah ada di
   tabel sejak migrasi 0007, hanya tidak pernah diambil.
2. Baris daftar berubah jadi dua baris: identitas di atas, ruas hulu–hilir dan
   nomor aset di bawah.
3. Bangunan terpilih diberi blok identitas lengkap tepat di atas kartu
   indikator, supaya penilai memastikan bangunannya **sebelum** mengisi.
4. Pencarian menjangkau nomor aset, kecamatan, dan bangunan hulu/hilir.
5. `penandaKembar()` menandai nomenklatur yang dipakai bersama, dengan
   peringatan lebih keras bila nomor asetnya pun kembar.
6. Peringatan bila `nama_di_buku` menunjuk D.I. yang lain.

Hasilnya 0 dari 9.996 bangunan yang tidak terbedakan. Rinciannya di
`PROGRESS.md` bagian "Identitas bangunan saat mengisi".

⚠️ **Nomor aset yang ditampilkan adalah nomor ASLI dari buku**, bukan nomor
bentukan sistem migrasi 0010. Lihat migrasi 0012 dan gotcha no. 22.

## 13. Perapian tampilan pengisian (18 September 2026)

Ditinjau dengan menjalankan aplikasinya dan menelusuri alur pengisian dari
sudut pandang petugas. Satu bendung berisi **33 kartu indikator**, dan
panjangnya lebih dari **7.500 piksel** dalam satu kolom tanpa jeda. Temuannya:

| Masalah | Perbaikan |
|---|---|
| Tiga kartu bertumpuk mendorong kartu isian jauh ke bawah lipatan | Pemilih jenis, penyaring, dan daftar disatukan jadi satu kartu |
| Tidak ada cara menemukan "mana yang belum saya kerjakan" pada 987 ruas saluran | Penyaring **Semua / Belum / Sebagian / Selesai** dengan hitungannya |
| Mengklik bangunan terasa tidak terjadi apa-apa karena kartu isian lahir di bawah layar | Gulir otomatis ke kartu isian |
| Di tengah 33 kartu, tidak ada tanda bangunan mana yang sedang diisi | Kepala kartu menempel: nama, letak, "bangunan 3 dari 23", bilah kemajuan |
| Tombol pindah bangunan hanya di puncak, ribuan piksel dari kartu terakhir | Tombol pindah diulang di kaki kartu |
| Tidak tahu kelompok mana yang masih bolong | Hitungan "3/3 terisi" di tiap kepala kelompok |
| Baris daftar meluber di layar sempit sampai lencana status terpotong | Baris dipecah tiga baris yang membungkus rapi |
| "Salin ke semua" menyebut jumlah yang lebih besar dari kenyataan | Menyebut jumlah bangunan yang benar-benar akan berubah |
| Tombol Ajukan mati tanpa keterangan | Sisa indikator disebut per komponen, bisa diklik untuk melompat |
| "Ulangi" dan "Hapus Penilaian" berwarna mencolok tepat di bawah "Ajukan" | Dilipat di balik **Tindakan lain** |

Kepala kartu yang menempel dan bilah tab sama-sama menempel di puncak, jadi
tingginya diukur saat jalan dan dibagikan lewat CSS variable `--bilah-tab`.
Tidak bisa ditulis tetap: bilah tab membungkus jadi satu sampai tiga baris
tergantung lebar layar, dan letaknya berbeda antara layar sempit (di bawah
header aplikasi) dan layar lebar (di puncak).

## 14. Sisa pekerjaan

- [x] ~~Jalankan migrasi 0009 ke Supabase.~~ **Selesai 15 September 2026.**
      Diverifikasi: tabel terbentuk, `penilaian_nilai.nilai` kini `numeric(6,3)`,
      dan rata-rata pecahan tersimpan utuh (81.667 dari nilai 80, 90, 75).
- [ ] Uji alur lengkap di browser: isi beberapa bangunan, cek rata-ratanya,
      ajukan, setujui, ekspor.
- [ ] Pastikan ke petugas lapangan soal 515 sadap "CORONGAN" (bagian 3).
- [ ] Putuskan apakah tombol Ajukan perlu memperingatkan bila baru sebagian
      bangunan dinilai. Sekarang satu bangunan terisi sudah membuat indikatornya
      dianggap terisi, sesuai aturan bagian 5.
- [ ] Rapikan 316 aset bangunan tanpa `di_id` (bagian 7).
- [ ] Perbarui `PROGRESS.md`.
