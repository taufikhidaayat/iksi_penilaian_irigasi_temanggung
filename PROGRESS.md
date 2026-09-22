# SIKSI — Status Pengerjaan

Sistem Penilaian Kinerja Sistem Irigasi (IKSI) — Dinas PUPR Kab. Temanggung.
Dokumen ini catatan lanjut-kerja. Perbarui tiap sesi.

**Status: fitur lengkap · database live & terverifikasi · siap dipakai.**

---

## Cara menjalankan

```bash
cp .env.example .env.local          # isi dari Supabase → Project Settings → API
npm install
npm run dev                          # http://localhost:3000
```

**Migrasi database** — otomatis lewat `DIRECT_URL`:

```bash
npm run db:cek          # uji koneksi + lihat status tabel
npm run db:migrasi      # jalankan seluruh migrasi berurutan
npm run db:verifikasi   # periksa RLS, trigger, dan integritas katalog
```

| Berkas | Isi |
|---|---|
| `supabase/migrations/0001_schema.sql` | Tabel, tipe, indeks, trigger |
| `supabase/migrations/0002_rls.sql` | Row Level Security + trigger profil otomatis |
| `supabase/migrations/0003_seed_master.sql` | 6 UPT + 270 indikator |
| `supabase/migrations/0004_seed_daerah_irigasi.sql` | 577 Daerah Irigasi |
| `supabase/migrations/0005_rename_triwulan.sql` | Label periode `TW I` → `Triwulan I` |
| `supabase/migrations/0006_username.sql` | Kolom `profil.username` + login pakai username |
| `supabase/migrations/0007_aset.sql` | Tabel `aset` (register aset irigasi) + RLS |
| `supabase/migrations/0008_ringkasan_aset.sql` | View `ringkasan_aset` untuk kartu jumlah |
| `supabase/migrations/0009_penilaian_aset.sql` | Tabel penilaian per bangunan (Komponen I) |
| `supabase/migrations/0010_kode_aset_upt.sql` | Nomor aset: golongan di segmen ke-3, UPT di segmen ke-4 |
| `supabase/migrations/0011_aset_draf.sql` | Tabel `aset_draf` + `aset_draf_berkas` (Data Aset Draf IKSI) |
| `supabase/migrations/0012_kode_asli.sql` | Nomor aset kembali ke nomor asli buku; nomor bentukan sistem pindah ke `kode_siksi` |
| `supabase/migrations/0013_tandai_di_beda.sql` | Menandai aset yang nama D.I. di buku berbeda dari D.I. tautannya |
| `supabase/migrations/0014_golongan_aset.sql` | Segmen golongan pada nomor aset: 01 bangunan, 02 tanah |
| `supabase/migrations/0015_golongan_nomor_tak_baku.sql` | Golongan untuk 13 nomor yang segmennya menyatu di buku |
| `supabase/migrations/0016_kode_upt.sql` | Segmen wilayah: 2 digit UPT + 3 digit nomor D.I.; kolom `kode_siksi` dihapus |
| `supabase/migrations/0017_bendung_baru.sql` | Nilai enum `bendung_baru`, wadah draf bendung versi berkas GIS .dbf |
| `supabase/migrations/0018_ringkasan_aset_unik.sql` | View ringkasan: pisahkan jumlah aset (identitas berbeda) dari jumlah baris |
| `supabase/migrations/0019_ringkasan_aset_draf.sql` | View ringkasan draf, bentuknya sejalan dengan `ringkasan_aset` |
| `supabase/migrations/0020_panjang_saluran.sql` | Kolom `aset.panjang` (meter) dari berkas GIS |
| `supabase/migrations/0021_salin_penilaian_periode.sql` | Fungsi `salin_penilaian_periode()` untuk menyalin satu periode sekaligus |
| `supabase/migrations/0022_edit_aset_draf.sql` | Kolom `diedit_manual`, `diubah_oleh`, `diubah_pada` pada `aset_draf` |

> Runner mencatat migrasi yang sudah dijalankan di tabel `_migrasi`, jadi
> `npm run db:migrasi` aman diulang — hanya berkas baru yang dieksekusi, dan
> tiap berkas dibungkus transaksi. Untuk database yang sudah terlanjur
> dimigrasi sebelum pelacakan ada:
> `node scripts/migrasi.mjs --tandai 0001_schema.sql 0002_rls.sql …`

> **Status proyek zegnkphfhvcjydjuhbrq: sudah dimigrasi** (PostgreSQL 17.6).
> `db:verifikasi` hijau — 7 tabel ber-RLS, 5 fungsi, 1 trigger, 6 UPT,
> 270 indikator, 577 D.I.
>
> Migrasi memakai **DIRECT_URL (port 5432, mode session)**, bukan DATABASE_URL
> (port 6543, mode transaction) — DDL seperti `CREATE TYPE` gagal lewat pooler
> mode transaction.
>
> **Kata sandi Postgres wajib di-URL-encode** di connection string:
> `#` → `%23`, `*` → `%2A`. Tanpa itu, `#` dibaca sebagai penanda fragment dan
> koneksi gagal dengan pesan autentikasi yang menyesatkan.

**Akun pertama** (wajib — tidak ada pendaftaran mandiri):

```bash
npm run buat-admin "Nama Lengkap" admin "KataSandiRahasia"
```

Selanjutnya akun UPT dibuat lewat menu **Pengguna** di aplikasi.

> **Akun yang sudah ada** (uji coba — ganti sebelum dipakai sungguhan):
>
> | Username | Peran | Kata sandi |
> |---|---|---|
> | `admin` | Administrator | `IksiAdmin#2026` |
> | `upt.temanggung` | Regional I | `UptIksi#2026` |
> | `upt.parakan` | Regional II | `UptIksi#2026` |
> | `upt.ngadirejo` | Regional III | `UptIksi#2026` |
> | `upt.kranggan` | Regional IV | `UptIksi#2026` |
> | `upt.kandangan` | Regional V | `UptIksi#2026` |
> | `upt.tembarak` | Regional VI | `UptIksi#2026` |

### Perintah lain

```bash
npm test            # 137 test — paritas hitungan & ekspor terhadap Excel, identitas aset
npm run build       # build produksi
npm run lint        # eslint
npx next typegen    # regenerasi tipe route (WAJIB setelah menambah halaman)

npm run e2e             # uji browser sungguhan (Playwright): login, toast, konfirmasi
npm run db:uji          # uji end-to-end auth + isolasi RLS antar UPT
npm run uji-halaman     # render tiap halaman sebagai admin & UPT (butuh dev jalan)
npm run contoh-ekspor   # hasilkan .xlsx dari data live untuk diperiksa manual
npm run buat-akun-upt   # buat 1 akun per UPT Regional
npm run impor-aset      # impor 11.045 aset dari BUKU ASET IRIGASI WORD 2026.docx (bendung dilewati)
npm run impor-aset -- --periksa   # hanya ringkasan, tanpa menulis
npm run impor-aset-draf  # impor 10.107 baris draf dari data/aset-draf/*.xlsx
npm run impor-aset-draf -- --periksa
npm run impor-bendung-baru  # impor 584 baris dari data/aset-draf/SDY bendung Kab.dbf
npm run impor-bendung-baru -- --periksa
npm run ganti-aset-bendung -- --periksa  # rencana penggantian aset Bendung, tanpa menulis
npm run ganti-aset-bendung            # jalankan penggantian
npm run tandai-aset-kembar -- --periksa  # daftar aset yang identik, tanpa menulis
npm run tandai-aset-kembar            # tandai perlu_tinjau
```

> **`npm run uji-halaman` wajib dijalankan setiap kali menyentuh layout, Shell,
> atau props yang menyeberang server → klien.** `npm run build` TIDAK menangkap
> galat serialisasi Server/Client Component — hanya render sungguhan yang bisa.

---

## Tech stack

| Bagian | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js 16.3.4** (App Router, TS) | Server Action → form 158 indikator tanpa API layer terpisah |
| Styling | **Tailwind CSS v4** | Token tema di `globals.css` (`@theme`), biru dominan |
| Database & Auth | **Supabase** | RLS memisahkan 6 UPT tanpa kode tambahan |
| Ekspor Excel | **ExcelJS** | Bisa menulis merge cell, border, format akuntansi |
| Grafik | **Recharts** | |
| Validasi | **Zod** | Dipakai di semua Server Action |
| Test | **Vitest** | Fokus pada paritas dengan Excel |

> `npm audit` melaporkan CVE `uuid` transitif dari ExcelJS (bounds check v3/v5/v6
> saat argumen `buf` dipakai). ExcelJS tidak memakai jalur itu; `audit fix --force`
> menurunkan ExcelJS ke v3 (breaking). Dibiarkan — cek ulang saat ExcelJS rilis baru.

---

## Hasil analisis Excel (TERVALIDASI — jangan diubah tanpa test ulang)

### Struktur penilaian
**270 node**, **158 indikator input**, hierarki 6 level. Bobot total tepat 100%:

| Kode | Komponen | Bobot | Indikator |
|---|---|---:|---:|
| I | Prasarana Fisik | 45 | 109 |
| II | Produktivitas Tanam | 15 | 3 |
| III | Sarana Penunjang OP | 10 | 15 |
| IV | Organisasi Personalia | 15 | 14 |
| V | Dokumentasi | 5 | 8 |
| VI | P3A/GP3A | 10 | 9 |

### Empat pola agregasi (dipetakan 1:1 dari formula kolom H)
1. `leaf` — `bobot × input / 100`
2. `weighted_children` — `bobot × SUM(anak) / 100` (bobot anak berjumlah 100)
3. `sum_children` — `SUM(anak)` (anak sudah berbobot absolut)
4. `sum_children_div100` — `SUM(anak) / 100`; **hanya 1 node**: VI.3 Kehadiran Rapat
   (bobot anak 100/60/40 = 200, dibagi 100 → maks 2 = bobot induk)

### ⚠️ Logika Kantong Lumpur (paling rawan)
Toggle `ada`/`tidak` mengubah bobot **18 node**:

| Node | ada | tidak |
|---|---:|---:|
| I.1.1-1 Bendung | 4 | 5 |
| I.1.1-2 Pintu-pintu bendung | 7 | 8 |
| I.1.1-3 Kantong lumpur | 2 | **0** |
| I.3.3-3.a.a-1.i Bocoran | 30 | 20 |
| I.3.3-3.a.a-1.ii Fasilitas penguras | **0** | 10 |

Plus 13 node turunan. Kedua skenario menghasilkan total **tepat 100.000000**.

**Jumlah indikator relevan berbeda:**
- kantong lumpur `ada` → **157** (Fasilitas penguras bobot 0)
- kantong lumpur `tidak` → **152** (sub-pohon Kantong Lumpur mati)

`isRelevan()` menelusuri **seluruh rantai induk**, bukan node itu saja — leaf di
bawah Kantong Lumpur berbobot 100 (relatif); yang di-nol-kan adalah induknya.

### Dua skala kategori (jangan tertukar)
- **Per indikator** (kolom I–L Form Penilaian): `<60` Jelek · `60–79` Sedang · `80–89` Baik · `90–100` Baik Sekali
- **IKSI total** (Permen PUPR 12/2015): `80–100` Sangat Baik (SB) · `70–79` Baik (B) · `55–69` Kurang (K) · `<55` Jelek (J)

### Modul Aset Irigasi (Permen PUPR 23/PRT/M/2015)

Sumber: `BUKU ASET IRIGASI WORD 2026.docx` (~866 halaman, `word/document.xml` 91 MB).
Diimpor jadi **11.045 aset** dari 15 jenis, tertaut ke D.I. lewat kode:

```
33 . 23 . 010306 . 0538 . 01001 . 2002    ← format buku
prov  kab   SDA      D.I.  tipe+urut  tahun
```

**Kode D.I. di buku = 4 digit terakhir kode D.I. di sistem** (`0538` → `33230538`).
Diverifikasi 14/14 pada sampel; 561 dari 563 kode buku cocok dengan master 577 D.I.

#### Nomor aset berformat SIKSI (migrasi 0014, 0015, 0016)

Buku sumber memberi nomor yang seragam se-kabupaten: `010306` pada segmen ke-3
untuk SELURUH aset, dan segmen ke-4 hanya memuat nomor D.I. tanpa penunjuk
wilayah. Akibatnya golongan aset maupun UPT pengelolanya tidak terbaca sama
sekali dari nomornya. Diperiksa ke dua sumber, tanpa satu pun pengecualian:

| Sumber | Segmen ke-3 asli | Baris |
|---|---|---:|
| Buku Aset (.docx) | `010306` semuanya | 11.467 |
| Berkas draf GIS (.xlsx) | `010306` semuanya | 9.924 |

Atas keputusan Dinas, dua segmen dibuat berbicara:

```
33 . 23 . 010306 . 01287 . 01001 . 2002
^^   ^^     ^^      ^^ ^^   ^^^^^   ^^^^
prov kab  golongan  |   |   tipe &  tahun
                    |   |   urut
                    |   nomor D.I. (3 digit)
                    UPT Regional (01..06)
```

| Segmen | Isi | Hasil |
|---|---|---:|
| ke-3 | `010306` bangunan (BAB III) | 9.852 aset |
| ke-3 | `020306` tanah (BAB IV), 8 jenis dari Tanah Saluran sampai Jalan Inspeksi | 1.615 aset |
| ke-4 | 2 digit UPT + 3 digit nomor D.I. | 11.274 aset |

**337 aset tidak punya segmen wilayah**: 193 belum tertaut D.I. sehingga
UPT-nya tidak diketahui, 13 nomornya tidak baku (segmen ke-4 dan ke-5 tertulis
menyatu di buku), sisanya kode D.I.-nya tidak dikenal master. Semuanya sudah
bertanda `perlu_tinjau`. Menebak UPT-nya justru menyembunyikan pekerjaan
perapian yang memang harus dilakukan petugas.

| Kolom | Isi | Ditampilkan? |
|---|---|---|
| `aset.kode` | nomor berformat SIKSI | **ya, di semua tempat** |
| `aset.kode_buku` | nomor buku apa adanya, jejak asal-usul | tidak |
| `aset_draf.kode` | nomor berformat SIKSI, aturan sama | **ya** |
| `aset_draf.kode_draf` | nomor berkas draf apa adanya | tidak |

⚠️ **Nomor di layar karena itu berbeda dari Buku Aset cetak.** `kode_buku`
tetap ikut dicari di halaman Aset, dan nomor draf apa adanya ikut masuk
`teks_cari`, supaya petugas yang mengetik nomor persis seperti di berkasnya
tetap menemukan barisnya.

Aturannya ada satu tempat saja untuk aplikasi: `nomorAset()` di
`src/lib/aset.ts`, dipakai server action penyuntingan aset. Skrip impor
memakai salinan aturan yang sama karena berjalan di luar bundel Next.
Penggantian golongan memakai regex yang **hanya menyasar ruas ke-3**, dan
segmen wilayah hanya disentuh bila ruas ke-4-nya paling banyak 5 digit —
keduanya supaya 13 nomor bersegmen menyatu lewat apa adanya.

Kolom `kode_siksi` yang sempat ada **dihapus** di migrasi 0016: isinya jadi
persis sama dengan `kode`, dan dua kolom yang wajib seiring hanya menunggu
saatnya berselisih.

> **Batas 3 digit nomor D.I.** Nomor D.I. muat di 3 digit selama master berisi
> ≤ 999 D.I. (sekarang 577). Migrasi 0016 berhenti dengan galat, bukan memotong
> digit, bila batas itu suatu saat terlampaui.

⚠️ **`aset.kode` SENGAJA tidak unik.** Buku sumber memuat 1.033 kode berulang —
mis. tiga bendung D.I. Ngasalan sama-sama `...0011.01001.2002` padahal
nomenklatur dan desanya berbeda. Yang mendekati unik adalah **nomenklatur**
(`BNDG.0229`), tetapi aset tanah (1.615 baris) tidak memilikinya sama sekali.
Karena itu kunci tabel adalah `id` internal.

Baris bermasalah **tidak dibuang** saat impor, melainkan ditandai `perlu_tinjau`
beserta alasannya, jadi daftar kerja di halaman Aset:
- 144 baris tanpa nomor aset (79 Sadap, 65 Saluran Pelimpah)
- kode D.I. `9000` (79 aset, penampung sementara) dan `0831` (7 aset) tidak ada di master
- 11 kode formatnya tidak baku (segmen menyatu)

### Data Aset Draf IKSI (menu khusus admin)

Sumber kedua, terpisah dari Buku Aset: hasil pendataan lapangan berbasis GIS,
8 berkas di `data/aset-draf/` berisi **10.691 baris**: 7 .xlsx dan 1 .dbf.
Sengaja tidak bertahun dan belum terverifikasi, jadi dipakai sebagai bahan
pembanding terhadap menu Aset Irigasi, bukan sumber resmi. Karena itu **hanya admin**
yang bisa membukanya, ditegakkan di tiga lapis: RLS, `ambilSesiAdmin()` di
halaman, dan pemeriksaan peran di route handler.

| Jenis | Baris | Kolom | Berkas |
|---|---:|---:|---|
| Saluran | 4.669 | 29 | `02.SALURAN FIX.xlsx` |
| Sadap | 3.116 | 35 | `03.SADAP FIX.xlsx` |
| Saluran Pelimpah | 527 | 28 | `04.PELIMPAH FIX.xlsx` |
| Terjunan | 514 | 26 | `05.TERJUNAN FIX.xlsx` |
| Talang | 50 | 26 | `06.TALANG FIX.xlsx` |
| Gorong-gorong | 556 | 28 | `07.GORONG GORONG FIX.xlsx` |
| Tanah Saluran | 675 | 12 | `12,TANAH SALURAN FIXXXX.xlsx` |
| Bendung Baru | 584 | 63 | `SDY bendung Kab.dbf` |

**Admin bisa mengedit langsung di tabel** (migrasi 0022): klik dua kali sebuah
sel untuk mengubahnya, tombol "Tambah baris" untuk menambah baris kosong, ikon
tempat sampah di kolom nomor (muncul saat kursor di atas baris) untuk
menghapus. Semuanya lewat `src/app/(app)/aset-draf/actions.ts`.

Baris yang ditambah/diubah manual tetap ditandai `diedit_manual = true` di
database (siapa dan kapan ada di `diubah_oleh`/`diubah_pada`), pola yang sama
dengan `massal` pada nilai per bangunan dan `perlu_tinjau` pada aset resmi.
**Sempat ditampilkan** sebagai latar kuning pudar + ikon pensil di kolom
nomor, tetapi dicabut lagi karena dirasa mengganggu di layar — kolomnya
sendiri sudah cukup jarang dilihat orang lain selain admin yang mengeditnya.
Datanya tetap tersimpan kalau suatu saat penanda ini mau ditampilkan lagi
dengan cara lain.

⚠️ **Yang SENGAJA tidak diikutkan**: menyunting sel tidak menjalankan ulang
`nomorAset()` atau pencocokan D.I. Pipeline itu panjang dan penuh pengecualian
per jenis (lihat `ganti-aset-bendung.mjs` dan tabel `KOREKSI_DI`-nya), dan
meniru sebagiannya di form edit berisiko salah pada kasus yang belum ketahuan.
Kolom nomor aset (`kolom_kode`, mis. "Nomor.Bang") karena itu ditulis apa
adanya ke kolom `kode` sesuai yang diketik admin, bukan diformat ulang otomatis.

> Kartu **Bendung** (`01.BENDUNG.xlsx`, 594 baris) DIHAPUS: Dinas memakai
> berkas GIS sebagai gantinya, dan menu Aset Irigasi pun sudah berisi data
> dari berkas itu. Berkas .xlsx-nya tetap disimpan di `data/aset-draf/` dan
> masih bisa diunduh, hanya tidak lagi diimpor: barisnya dihapus dari
> `aset_draf`, dan entrinya dicabut dari `BERKAS` di skrip impor serta dari
> `JENIS_DRAF`.

**Kolomnya tidak dijadikan kolom tabel.** Susunannya berbeda jauh antar jenis
(63 lawan 12) dan tidak ada irisan yang berarti, jadi satu baris disimpan apa
adanya di `aset_draf.data` (jsonb) dan urutan kolom aslinya dicatat sekali per
jenis di `aset_draf_berkas.kolom`. Ekspor membaca urutan itu kembali, sehingga
berkas hasil ekspor sejajar dengan berkas draf aslinya: nama sheet, nama kolom,
dan urutannya identik (diperiksa di `npm run uji-halaman`). Menambah berkas
draf baru cukup menambah satu baris di `BERKAS` pada skrip impor, tanpa migrasi.

**Pencarian disamakan dengan menu Aset Irigasi.** Kotak cari menyasar kolom
identitas saja, bukan seluruh kolom, supaya kata kunci yang sama memberi
jawaban yang sama di kedua menu. Daftar kolomnya per jenis ada di `KOLOM_CARI`
(`src/lib/aset-draf.ts`), padanan dari tujuh kolom yang dicari menu Aset
Irigasi:

| Aset Irigasi | Draf |
|---|---|
| `nomenklatur` | `NUM` / `nomenk` / `noment` |
| `nama` | `Keterangan` / `Nama_sal` / `NAMA_SALUR` |
| `nama_di_buku` | `LAYER` / `NAME` / `NAMA DI` |
| `desa`, `kecamatan` | `DESA`, `KECAMATAN` (hanya jenis yang punya) |
| `kode`, `kode_buku` | kolom tabel `kode` dan `kode_draf` |

Sebelumnya menu ini mencari ke seluruh kolom lewat `teks_cari`, sehingga
"Pasangan Batu" mengembalikan 448 baris dan "Ogee" 39, padahal kata yang sama
nihil di menu Aset Irigasi. `teks_cari` tetap ada sebagai cadangan bagi jenis
yang belum punya daftar kolom identitas.

**Kode D.I. 4 digit tetap bisa diketik.** Di menu Aset Irigasi, mengetik
`0001` mengenai segmen ke-4 `kode_buku` sehingga menunjuk D.I. 1. Bendung Baru
tidak punya nomor buku yang sahih, jadi kata kunci berupa 1-4 digit
dicocokkan PERSIS ke kolom `Nomer DI` setelah nol di depannya dibuang.

Sejalan dengan itu, `kode_draf` TIDAK ikut dicari untuk `bendung_baru`
(`KODE_DRAF_TAK_DICARI`). 556 dari 584 barisnya memuat nomor contekan yang
sama persis, `33.23.010306.0001.01001.2002`; selama nomor itu ikut dicari,
mengetik `0001` mengembalikan 556 baris yang tidak ada hubungannya dengan
D.I. 1.

> Hasilnya tidak selalu sama angkanya dengan menu Aset Irigasi, dan itu benar.
> `0001` memberi 7 baris di Aset Irigasi tetapi 2 di Bendung Baru, sebab lima
> di antaranya bernomor buku `...0001...` padahal menurut berkas GIS berada di
> D.I. 552, 162, 261, 442, dan 32. Nomor D.I. 1 memang penampungan salah kode
> di Buku Aset. Sisanya sama: BD Aji Bangkong yang sungguh-sungguh di D.I. 1,
> dan BNDG.0001 yang kena lewat nomenklaturnya.


> **Bug yang ikut ketahuan dan dibetulkan.** Kata kunci pada filter `or()`
> PostgREST WAJIB dikutip; koma dan kurung di dalamnya dibaca sebagai sintaks
> filter. Di menu Aset Irigasi, mencari `(MA)` mengembalikan 0 baris padahal
> ada 345, dan `a,b` membuat permintaannya ditolak server. Yang pertama paling
> berbahaya: tidak ada galat, daftarnya sekadar kosong, padahal puluhan bendung
> memang bernama "PMA ... (MA)". Pengutipannya kini terpusat di
> `src/lib/cari.ts` dan dipakai kedua menu.

**Nomor aset ikut berformat SIKSI.** Berkas draf memuat nomornya pada kolom
`Nomor.Bang` (atau `NOMOR BANG` / `Nomor Tanh`). Golongan dan segmen wilayah
dipasang dengan aturan yang sama persis seperti menu Aset Irigasi, supaya nomor
di kedua menu bisa disandingkan langsung — memang itu gunanya menu Draf.

| | Baris |
|---|---:|
| Berformat SIKSI (golongan + wilayah) | 9.840 |
| Tetap format draf (D.I. tidak dikenali / nomor menyatu) | 84 |
| Tidak punya nomor aset di berkas | 777 |

Kolom kodenya diganti saat ekspor juga, sedangkan `aset_draf.data` tetap
menyimpan nomor draf apa adanya.

> **Tombol "Berkas asli" (unduh .xlsx/.dbf mentah dari `data/aset-draf/` apa
> adanya) sengaja DIHAPUS** — bukan lupa dibuat. Awalnya ada supaya admin bisa
> membandingkan nomor tampilan dengan berkas sumber, tetapi menu ini memang
> tidak pernah punya fitur edit sama sekali (murni bahan pembanding, baca +
> cari + Ekspor Excel saja), dan admin yang sungguhan memegang akun ini sudah
> punya akses langsung ke berkas sumbernya di luar aplikasi. Jadi tombolnya
> cuma jalan pintas ke sesuatu yang sudah bisa mereka buka sendiri. Ikut
> dihapus: cabang `?asli=1` di `/api/aset-draf/[jenis]`, dan seluruh isi
> `outputFileTracingIncludes` di `next.config.ts` (satu-satunya alasan
> `data/aset-draf/` perlu ikut ke build standalone).

#### Bendung Baru (berkas .dbf)

Kartu kesembilan, dari `SDY bendung Kab.dbf` hasil GIS. Isinya bendung juga,
tetapi **bukan versi lain** dari `01.BENDUNG.xlsx` (kini sudah dihapus): 584
baris lawan 594, dan
satu kolom tambahan, `UPT`. Keduanya sengaja disimpan berdampingan sebagai dua
kartu sampai Dinas memutuskan mana yang dipakai; tidak ada yang menimpa.

Formatnya dBase, bukan .xlsx, jadi impornya berdiri sendiri di
`scripts/impor-bendung-baru.mjs` (pembaca dBase ditulis sendiri, belasan baris,
tanpa dependensi baru). Skrip itu hanya menghapus-tulis baris berjenis
`bendung_baru`; sebaliknya `impor-aset-draf` kini juga hanya menghapus delapan
jenis yang diurusnya, supaya kedua skrip tidak saling menghapus hasil.

**D.I. diambil dari kolom `Nomer DI`, bukan dari nomor aset.** Ini satu-satunya
jenis draf yang begitu. Sebabnya nomor aset di berkas ini belum digarap: 584
baris hanya memuat 25 nomor berbeda, dan segmen ke-4-nya cuma 21 nilai, jadi
satu nomor dipakai puluhan bendung sekaligus. Kolom `Nomer DI` justru bersih,
dan hasilnya terbukti: 584 dari 584 baris tertaut D.I., dan nama D.I. pada
berkas cocok dengan master pada 579 di antaranya.

**Segmen UPT diambil dari kolom `UPT` berkas GIS**, bukan dari
`daerah_irigasi.upt_id` seperti jenis draf lain. Menurut Dinas pembagian UPT di
berkas GIS inilah yang mutakhir; master masih memuat pembagian lama dan berbeda
di 386 dari 584 baris. Satu baris yang kolom UPT-nya kosong (D.I. 523, BD
Silumut Ngadirejo) memakai UPT master sebagai cadangan.

> Akibatnya nomor bendung di menu ini BERBEDA dari menu Aset Irigasi, yang
> masih memakai UPT master seperti 15 jenis aset lainnya. Itu disadari dan
> dibiarkan: register menyusul setelah master dibetulkan.

**Jumlahnya 577, bukan 584.** 584 baris dikurangi 7 bendung suplesi (namanya
memuat "spl" atau "suplesi", dan semuanya nebeng di D.I. yang sudah punya
bendung utama) menghasilkan tepat **577 bendung utama**, sama dengan jumlah
D.I. Ketujuhnya: BDspl Kalinongko Wanutengah (D.I. 11), BDspl Gesingsuroloyo 2
(45), BDspl Kuwelan 2 (85), BD Suplesi Kwagean 2 (86), BDspl Salam (137),
BDspl Sigondang (475), Spl Silingseng (524).

**Satu nomor D.I. dibetulkan saat impor** lewat tabel `KOREKSI_DI` di skrip,
bukan dengan menyunting berkas .dbf-nya, supaya berkas dari Dinas tetap utuh:

| Bendung | Di berkas | Dibetulkan jadi | Dasar |
|---|---:|---:|---|
| PMA Sirancah (MA) | 258 | 252 | `LAYER` baris itu tertulis `DI SIRANCAH (MA)`; D.I. 252 memang bernama "D.I. Sirancah (MA)", sedangkan 258 "D.I. Sitalang Kedu" |

Sesudah koreksi itu, 575 D.I. punya bendung utama. Dua yang tersisa:

- **D.I. 241 Sipelus Kandangan** memang tidak punya bendung sendiri. `LAYER`
  bendung di D.I. 240 tertulis `DI SIPELUS KALORAN (240 dan 241)`; petugas
  survei mencatat satu bendung melayani dua D.I. Bukan data hilang.
- **D.I. 161 Sidodadi** belum ketahuan yang mana. Master punya empat D.I.
  bernama Sidodadi di nomor 161-164, berkasnya menaruh dua bendung di 164
  (Lowungu di Bansari, Jumo di Parakan) dan mengosongkan 161. Master tidak
  membedakan keempatnya dengan keterangan apa pun, jadi dari data saja tidak
  bisa ditentukan. Menunggu jawaban Dinas.

Yang masih harus diputuskan Dinas sebelum data ini bisa dipakai:

| Temuan | Jumlah |
|---|---:|
| Nomor D.I. dipakai dua baris (bendung utama + suplesi, atau benar-benar tabrakan) | 10 |
| Nomor D.I. yang tidak muncul sama sekali (161, 241, 252) | 3 |
| Baris tanpa koordinat `X`/`Y` | 26 |
| Baris tanpa isi kolom `UPT` (DI 523, BD Silumut Ngadirejo) | 1 |
| Kolom `UPT` berbeda dari `daerah_irigasi.upt_id` di master | 387 |

Dua di antara nomor dobel itu jelas keliru, bukan sekadar suplesi: `Nomer DI`
258 dipakai PMA Sirancah (Kaloran) sekaligus BD Sitalang Kedu (Wonoboyo), dan
`Nomer DI` 11 dipakai BD Aji Nongko sekaligus BDspl Kalinongko Wanutengah.

Segmen UPT pada nomor asetnya memakai `daerah_irigasi.upt_id` dari master,
sama seperti seluruh jenis draf lain, bukan kolom `UPT` berkas ini. Kolom itu
tetap tersimpan utuh di `aset_draf.data` dan tetap ikut dicari.

#### Bendung diganti dari berkas GIS (`npm run ganti-aset-bendung`)

Atas permintaan Dinas, data Bendung di register resmi diganti dengan isi draf
Bendung Baru. Baris dipasangkan lewat nomenklatur: kolom `NUM` di berkas GIS
berisi nilai yang sama dengan `aset.nomenklatur`. Pasangannya jatuh 1:1:

| | Baris |
|---|---:|
| Diperbarui di tempat, `aset.id` tidak berubah | 558 |
| Disisipkan sebagai bendung baru, tidak ada di Buku Aset | 26 |
| Dipertahankan, tidak ada di berkas GIS (seluruhnya belum tertaut D.I.) | 8 |
| **Bendung sesudahnya** | **592** |

Yang 558 **diperbarui, bukan dihapus lalu disisipkan ulang**, supaya `aset.id`
tidak berubah. `penilaian_aset_nilai` menunjuk id itu dengan `on delete
cascade`; menghapusnya akan ikut menghapus nilai yang sudah diisi petugas.

Nomor asetnya dihitung ulang dari `kode_buku` memakai aturan yang sama persis
dengan sebelumnya, jadi formatnya tidak berubah sedikit pun. Yang berubah
hanyalah D.I. tautannya, dan karena itu segmen wilayahnya ikut terkoreksi pada
21 baris. Nomor buku tidak pernah disentuh.

Segmen UPT tetap diambil dari `daerah_irigasi.upt_id`, **bukan** dari kolom
`UPT` berkas GIS. Keduanya berbeda di 387 dari 584 baris. Master yang dipakai
supaya nomor Bendung sebangun dengan seluruh jenis aset lain; kolom `UPT` asli
tetap tersimpan utuh di `aset_draf.data`.

Yang perlu diketahui sebelum angkanya dipercaya:

- **22 bendung berpindah D.I.** 7 dari belum tertaut jadi tertaut, 15 pindah
  antar-D.I. Dari 15 itu, 14 jelas koreksi (nama bendung cocok dengan nama D.I.
  tujuannya, sedangkan tautan lama banyak yang nyasar ke D.I. Aji Bangkong).
  Satu keliru: BNDG.0515 PMA Sirancah pindah ke D.I. Sitalang Kedu karena nomor
  D.I. 258 dipakai dua bendung di berkas GIS. Harus dibetulkan manual.
- **14 bendung berubah nama** dari "Bendung Tetap" jadi "Tidak Ada", mengikuti
  kolom `type_bdgng` berkas GIS apa adanya.
- **26 bendung baru ditandai `perlu_tinjau`**: nomor urut objeknya (segmen ke-5)
  dibentuk skrip, bukan berasal dari Dinas. Nomenklatur dan `kode_buku`-nya
  sengaja dibiarkan kosong supaya tidak tampak seolah bersumber dari buku.

Skripnya **aman diulang**. Baris sisipan dikenali kembali lewat penanda asal di
`catatan` dan nomornya dipakai lagi apa adanya, jadi jalan kedua tidak
menyisipkan baris kembar maupun menggeser nomor yang sudah dipakai di lapangan.
Sebelum apa pun berubah, seluruh baris bendung disalin ke `data/cadangan/`.

> **Bendung tidak lagi bersumber dari buku.** `npm run impor-aset` dulu
> mengosongkan SELURUH tabel `aset` sebelum menulis ulang isinya dari
> `BUKU ASET IRIGASI WORD 2026.docx`. Sekali dijalankan lagi setelah
> penggantian ini, seluruh bendung versi GIS tertimpa diam-diam dan 26 bendung
> yang hanya ada di berkas GIS hilang untuk selamanya, berikut nilai penilaian
> per bangunan yang menunjuknya lewat `on delete cascade`.
>
> Karena itu skrip itu kini melewati jenis `bendung` sepenuhnya
> (`JENIS_BUKAN_DARI_BUKU`): barisnya tidak diimpor, dan pengosongan tabelnya
> dibatasi pada jenis yang memang bersumber dari buku. Impornya sekarang
> 11.045 baris dari 15 jenis, bukan 11.611 dari 16.

> Draf Bendung Baru sendiri TIDAK ikut berubah: tetap 584 baris, 63 kolom.
> Menu Aset Draf adalah bahan pembanding, dan tetap begitu setelah penggantian.

#### Jumlah aset, bukan jumlah baris

Kartu **Rincian per Jenis** dulu menampilkan `count(*)`, yaitu jumlah baris.
Sejak migrasi 0018, angka yang ditonjolkan adalah **jumlah aset**: identitas
yang berbeda, dirangkai dari nomenklatur, nama, nomor aset, D.I., desa, dan
kecamatan. Jumlah barisnya turun jadi keterangan kecil dan **hanya muncul bila
berbeda**, sehingga selisihnya terbaca sebagai penanda data yang perlu
dirapikan, bukan tersembunyi.

Tiga jenis yang angkanya berbeda:

| Jenis | Aset | Baris | Selisih |
|---|---:|---:|---:|
| Tanah Saluran | 673 | 675 | 2 |
| Tanah Bangunan Saluran | 589 | 591 | 2 |
| Tanah Tidak Tersedia KIB | 11 | 12 | 1 |
| **Seluruhnya** | **11.632** | **11.637** | **5** |

Lima baris itu identik seluruh identitasnya, jadi tidak bisa dibedakan siapa
pun yang memeriksanya di lapangan. Barisnya **tidak dihapus**: menghapus salah
satu berarti menebak mana yang palsu, padahal bisa jadi memang ada dua
bangunan berdampingan yang datanya belum dibedakan. Semuanya ditandai
`perlu_tinjau` lewat `npm run tandai-aset-kembar`, sehingga muncul di daftar
kerja perapian dan keputusannya diserahkan kepada petugas UPT yang mengenal
lapangannya. Skrip itu aman diulang dan melepas tandanya sendiri bila
barisnya kelak tidak kembar lagi.

Kartunya juga menyebut **berapa D.I.** yang diwakili tiap jenis. Petugas yang
terbiasa dengan kerangka 577 D.I. melihat 592 bendung dan bisa menyangka ada
salah hitung; dengan keterangan "574 D.I." hubungan kedua angka itu langsung
terbaca. Selisih bendung sendiri memang nyata: 577 bendung utama, 7 bendung
suplesi, dan 8 bendung buku yang belum tertaut D.I.

> Angka kartu SENGAJA tidak diturunkan jadi 577. Kartu yang menyebut 577
> sementara daftar di bawahnya memuat 592 baris adalah kebingungan yang lain
> lagi, dan yang lebih sulit ditelusuri.


Kartu di menu **Aset Draf** memakai perlakuan yang sama (view
`ringkasan_aset_draf`, migrasi 0019): angka besarnya jumlah aset dengan satuan
"aset", bukan "baris", ditambah jumlah D.I. sebagai keterangan. Dua menu yang
menghitung hal yang sama dengan satuan berbeda hanya menimbulkan salah paham.

Di sinilah kebingungannya paling terasa: nomor D.I. cuma sampai 577, tetapi
kartu Bendung Baru menampilkan 584 tanpa penjelasan apa pun di layar. Dengan
keterangan "575 D.I.", selisihnya langsung terbaca sebagai beberapa D.I. yang
punya lebih dari satu bangunan.

Tidak satu pun dari 8 berkas draf memuat baris kembar, jadi `jumlah_aset`
selalu sama dengan `jumlah`. Kolomnya tetap disediakan supaya berkas draf
berikutnya yang memuat baris ganda langsung ketahuan, tanpa perlu mengubah
apa pun lagi.

**Jumlah aset per D.I. — alasan IKSI dinilai agregat:**

| | Total | D.I. punya | Punya >1 | Terbanyak |
|---|---:|---:|---:|---:|
| Bendung | 592 | 574 | 10 | 2 |
| Sadap | 3.115 | 416 | 360 | 68 |
| Saluran | 4.642 | 348 | 324 | 987 |

IKSI **tidak** menilai per unit. Deskriptor kondisinya berbicara soal keseluruhan
jaringan — "Setiap ruas berubah", "Sadap liar tiap 50 m", "Prosentase ... dalam
kondisi baik". Jadi tetap **satu penilaian per D.I. per triwulan**; daftar aset
hanya ditampilkan sebagai konteks di dalam form.

### Identitas bangunan saat mengisi (audit 18 September 2026)

Penilaian Komponen I dikerjakan **per bangunan**, jadi salah mengenali baris
berarti nilai masuk ke bangunan yang keliru — dan tidak ada mekanisme lain yang
akan menangkapnya. Audit atas 9.996 bangunan menemukan daftar di form dulu
menampilkan **nomenklatur + nama + desa saja**, yang tidak cukup:

- **Seluruh 4.642 saluran bernama sama persis**, "Saluran Sekunder". Kolom
  `nama` untuk saluran tidak punya nilai lain.
- **14 D.I. punya saluran dengan nomenklatur kembar.** Terparah D.I. Sandong:
  11 ruas sama-sama `SAL.03783`, sama namanya, sama ruas hulu–hilirnya, sama
  Desa Jamusan Kec. Jumo. Pembedanya hanya empat digit di tengah nomor aset.
- **10 saluran tidak punya nomenklatur** sama sekali (D.I. 275).
- **Nomor aset pun berulang**: D.I. Sandong punya dua saluran bernomor
  `...0397.02001.2002` di desa berbeda.

Karena itu form sekarang membawa dan menampilkan keping identitas yang lengkap:

| Keping | Sumber | Kegunaan |
|---|---|---|
| Nomenklatur | `aset.nomenklatur` | sebutan lapangan |
| Nama | `aset.nama` | jenis bangunan |
| **Ruas** | `bangunan_hulu` → `bangunan_hilir` | pembeda antar-ruas saluran |
| **Letak** | `desa`, `kecamatan` | memastikan lokasi |
| **Nomor aset** | `aset.kode` (asli buku) | dicocokkan dengan berkas cetak |

Hasilnya: **0 bangunan yang tidak terbedakan** dari 9.996, dari sebelumnya
puluhan. `penandaKembar()` tetap ada sebagai jaring pengaman dan menandai
nomenklatur yang dipakai bersama, karena nomenklatur itulah yang paling
menonjol di daftar dan ke situ pula mata penilai tertuju.

**Yang masih kurang dan butuh keputusan Dinas:**

| Temuan | Jumlah | Akibat |
|---|---:|---|
| Gorong-gorong tanpa desa & kecamatan | 556 | letaknya tidak bisa ditampilkan |
| Bangunan pengaman tanpa desa, kecamatan, nomenklatur | 28 | hanya nomor aset yang membedakan |
| Sadap tanpa nomor aset | 79 | tidak bisa dicocokkan dengan buku |
| Saluran pelimpah tanpa nomor aset | 65 | sama |
| Bangunan tanpa `di_id` | 316 | **tidak akan pernah muncul di form mana pun** |

Berkas draf GIS tidak bisa menambal yang pertama: `07.GORONG GORONG FIX.xlsx`
memang tidak punya kolom DESA, hanya koordinat X/Y/Z.

### ⚠️ Aset yang mungkin tertaut ke D.I. yang salah (migrasi 0013)

Penautan aset ke Daerah Irigasi dikerjakan **semata-mata lewat kode 4 digit**
pada nomor aset, tanpa pernah mencocokkan namanya. Satu kode yang keliru di
buku karena itu memindahkan seluruh bangunannya ke D.I. lain tanpa ada yang
tahu — dan sejak penilaian per bangunan, bangunan itu akan dinilai oleh UPT
yang salah, pada D.I. yang salah.

Dari 11.274 aset yang tertaut dan punya nama D.I. di buku:

| | Aset |
|---|---:|
| Nama buku = nama master | 9.564 |
| Beda ejaan / penyebutan lebih panjang (dianggap sama) | 684 |
| **Nama D.I. benar-benar berbeda** | **1.026** |

235 pasangan D.I. berbeda. Contoh terbesar:

| Nama di buku | Tertaut ke | Aset |
|---|---|---:|
| DI SILUMUT KARANGTEJO | D.I. Aji Bangkong (33230001) | 176 |
| DI NDUREN | D.I. Sandong (33230397) | 55 |
| DI Kalinongko suplesi | D.I. Aji Nongko (33230011) | 48 |
| DI KALIPACAR TEMANGGUNG | D.I. Kd. Buntung (33230064) | 44 |
| DI BELIK KUTOANYAR | D.I. Aji Tegowanuh (33230289) | 41 |

Migrasi 0013 **tidak memindahkan apa pun** — memindahkan berarti menebak, dan
tebakan yang salah lebih berbahaya daripada data yang ditandai. Yang dilakukan
hanya menandainya `perlu_tinjau` supaya muncul sebagai daftar kerja di halaman
Aset, dan form penilaian memperingatkan langsung di kartu bangunannya.

Perbandingannya memakai trigram similarity (`pg_trgm`, ambang 0.4), bukan
sama-persis, supaya "Pucung 2" lawan "Pucung II" tidak ikut tertandai. Fungsi
`nama_di_baku()` di database dan `namaDiBaku()` di `src/lib/aset.ts` sengaja
dibuat identik, supaya daftar kerja dan peringatan di layar tidak pernah
berbeda kesimpulan.

### Master data
- **577 D.I.** (kode 33230001–33230577), semuanya punya UPT.
- **6 UPT**: I-Temanggung(47) · II-Parakan(104) · III-Ngadirejo(175) · IV-Kranggan(75) · V-Kandangan(113) · VI-Tembarak(63)

### Kolom tambahan "Kondisi Prasarana Fisik" (bukan bagian template)

Kolom **M** disisipkan atas permintaan Dinas: nilai Prasarana Fisik pada
skalanya sendiri (0–100), bukan sumbangannya ke total yang maksimumnya 45.
Alasannya angka seperti 36 sulit dibaca sebagai "seberapa baik prasarananya",
padahal itu setara 80%.

- **Informasi saja.** Tidak masuk rentang `SUM` kolom Jumlah, tidak mengubah
  nilai IKSI, dan tidak diberi nomor di baris 9 (nomor-nomor itu dirujuk teks
  catatan "Kolom 9-15", jadi memberinya nomor akan membuat catatan salah).
- Ditulis sebagai formula `IF(N..="","",N../45*100)` supaya ikut berubah bila
  Total diedit di Excel.
- Pembaginya diambil dari katalog lewat `BOBOT_PRASARANA_FISIK`, bukan angka 45
  yang ditulis tangan.

⚠️ **Seluruh kolom template dari M ke kanan bergeser satu huruf** (Total
Prasarana Fisik M→N, … Jumlah S→T). Blok tanda tangan ikut bergeser Q:S → R:T.
Karena itu test paritas membandingkan lewat fungsi `geser()`, bukan pada alamat
sel yang sama — membandingkan alamat yang sama akan lolos secara palsu.

### Template rekap (`IKSI 2026 FINAL.xlsx`)
- Baris 10–586 data · baris 587 Total (luas `SUM`, skor **`AVERAGE`**) · catatan 589–599 · tanda tangan 602–611 (kolom Q, merge Q:S).
- Kolom C = awalan `"D.I."`, kolom D = nama tanpa awalan. Kolom E ("Tahun") kosong di baris data.
- **Inkonsistensi di file sumber:** penomoran baris 9 memberi M=11…S=17, tetapi catatan
  baris 598 menyebut "Kolom 9…15" (selisih 2). Ekspor mengikuti **layout sel**, dan
  teks catatan disalin apa adanya.
- Areal terdampak **tidak diturunkan** dari Form Penilaian → jadi input terpisah (tab "Areal Terdampak").

---

## Verifikasi (WAJIB tetap hijau)

```
npm test     →  137 passed
```

**Mesin skoring** (`scoring.test.ts`, 32 test)
- Mereproduksi **seluruh 270 nilai cache Excel**, 0 mismatch
- Total master **99.946** ✓ persis sel H9
- Semua indikator = 100 → total **100.000000** pada kedua skenario kantong lumpur
- Fixture: `src/lib/iksi/__fixtures__/master-excel.json`

**Ekspor Excel** (`rekap-excel.test.ts`, 26 test) — sebagian membandingkan
**langsung terhadap `IKSI 2026 FINAL.xlsx`**:
- Judul kolom, penomoran baris 9, lebar kolom, format angka → identik
- Baris Total memakai `AVERAGE` untuk skor & `SUM` untuk luas
- Kolom Jumlah ditulis sebagai formula hidup, bukan angka mati
- Catatan kriteria IKSI lengkap

---

## Yang SUDAH selesai

- [x] Ekstraksi + validasi penuh kedua Excel
- [x] `src/lib/iksi/` — katalog 270 node, tipe, mesin skoring
- [x] Migrasi DB + RLS + seed (6 UPT, 270 indikator, 577 D.I.)
- [x] Supabase client (browser/server/proxy) + proteksi rute
- [x] Tema biru + UI kit + komponen Dialog
- [x] **Masuk** — split panel, ilustrasi skema irigasi SVG inline
- [x] App shell (sidebar responsif) & navigasi berbasis peran
- [x] **Dasbor** — statistik, donut kategori, bar per-UPT, tabel progres
- [x] **Penilaian** — daftar + filter + dialog buat baru
- [x] **Form penilaian** — tab per komponen, kartu 4-deskriptor klik-cepat,
      slider penyetel, skor langsung, autosave 2 detik, tab Areal Terdampak
- [x] Alur status: draft → diajukan → disetujui / revisi
- [x] **Salin penilaian periode sebelumnya** — per D.I. dari dalam form, dan
      satu periode sekaligus lewat fungsi SQL; yang sudah dinilai dilewati
- [x] **Edit langsung di Data Aset Draf** — ubah sel, tambah/hapus baris,
      asal suntingan tetap tercatat di database (lihat `diedit_manual`)
- [x] **Rekapitulasi** — tabel gaya template, filter UPT, paginasi, baris Total
- [x] **Ekspor Excel** — pratinjau + unduh, blok tanda tangan bisa diatur
- [x] **Daerah Irigasi** — master data, pencarian
- [x] **Pengguna** — buat akun, aktif/nonaktif, atur ulang sandi (admin)
- [x] Skrip `npm run buat-admin`
- [x] Login memakai **username**, bukan email
- [x] **Toast notifikasi** berbahasa Indonesia (sukses/galat/info/peringatan)
- [x] **Dialog konfirmasi** untuk aksi yang sulit dibatalkan
- [x] Tombol verifikasi Administrator (Setujui / Kembalikan untuk Revisi)
- [x] Uji browser Playwright — 15 skenario
- [x] **Modul Aset Irigasi** — 11.637 aset (11.045 dari buku + 592 bendung dari
      berkas GIS), daftar + cari + filter + paginasi,
      tambah/ubah/hapus, penanda "perlu ditinjau"
- [x] Konteks aset di form penilaian (menjawab "bendung yang mana yang dinilai?")

- [x] Migrasi dijalankan ke Supabase (proyek `zegnkphfhvcjydjuhbrq`)
- [x] Uji end-to-end auth + isolasi RLS antar UPT (`npm run db:uji`)
- [x] Ekspor 577 baris diverifikasi baris-demi-baris terhadap template
- [x] Akun Administrator pertama dibuat

## Yang BELUM

- [ ] Ganti kata sandi admin & UPT bawaan
- [ ] Jalankan migrasi 0021 dan 0022 ke Supabase (`npm run db:migrasi`).
      Tombol "Salin dari periode lain" dan edit di Data Aset Draf tidak akan
      jalan sebelum kolom/fungsinya ada di database
- [ ] Penanda asal salinan (`disalin_dari` + lencana), supaya verifikator bisa
      membedakan penilaian salinan dari hasil survei baru
- [ ] Buat akun UPT sungguhan lewat menu Pengguna
- [ ] Uji alur lengkap lewat UI: isi penilaian → ajukan → admin setujui → ekspor
- [ ] Buka `IKSI_2026_TWIII.xlsx` di Excel, bandingkan visual dengan template
- [ ] Rapikan 1.373 aset bertanda "perlu ditinjau" lewat halaman Aset
      (347 temuan lama + 1.026 nama D.I. berbeda dari migrasi 0013)
- [ ] **Putuskan 1.026 aset yang nama D.I.-nya berbeda** — mulai dari 176 aset
      "DI SILUMUT KARANGTEJO" yang tertaut ke D.I. Aji Bangkong. Ini yang
      paling berisiko membuat penilaian masuk ke D.I. yang salah.
- [ ] Putuskan nasib kode D.I. `9000` dan `0831` (tambah ke master, atau petakan ulang)
- [ ] Lengkapi letak 556 gorong-gorong + 28 bangunan pengaman (tidak ada di
      berkas draf GIS, harus dari data lapangan)
- [ ] Lengkapi nomor aset 79 sadap + 65 saluran pelimpah
- [ ] Tautkan 316 bangunan yatim ke D.I.-nya — selama tidak tertaut, bangunan
      itu tidak akan pernah bisa dinilai
- [ ] Deploy (Vercel) + set environment variable produksi
- [ ] Rotate kata sandi database (sempat dibagikan saat setup)

---

## Keputusan desain

**Login satu pintu.** UPT ditentukan dari **akun**, bukan dropdown saat login.
Lebih aman (tidak bisa salah/iseng pilih UPT lain) dan RLS jadi satu-satunya
sumber kebenaran.

**Skor dihitung ulang di server** saat simpan — angka kiriman browser tidak
dipercaya, supaya rekap & ekspor tidak bisa dimanipulasi dari klien.

**Menyalin penilaian triwulan sebelumnya.** Kondisi jaringan jarang berubah
banyak antar triwulan, sedangkan satu UPT memegang sampai 175 D.I. berisi 158
indikator. Ada dua jalan, keduanya menghasilkan draf yang tetap harus diperiksa
dan diajukan seperti biasa:

| Jalan | Letak | Lingkup |
|---|---|---|
| Per D.I. | kartu di dalam form penilaian yang sedang dibuka | satu D.I., sumbernya dipilih dari riwayat D.I. itu |
| Satu periode sekaligus | tombol di sebelah pemilih periode, halaman Penilaian | seluruh D.I. dalam lingkup UPT yang sedang tampil |

**D.I. yang sudah punya penilaian di periode tujuan tidak pernah disentuh**, apa
pun statusnya. Karena itu tombolnya aman ditekan berulang kali dan draf yang
sedang dikerjakan orang lain tidak ikut tertimpa. Laporannya menyebut tiga
angka: berapa yang disalin, berapa dilewati karena sudah dinilai, dan berapa
D.I. yang tetap harus diisi tangan karena periode sumbernya juga kosong.

Salinan sekaligus dikerjakan **fungsi SQL** (`salin_penilaian_periode`), bukan
loop PostgREST dari server action: satu UPT bisa berarti puluhan ribu baris
`penilaian_aset_nilai` (D.I. terberat sendirian 5.197 baris), yang lewat HTTP
berarti ratusan permintaan berurutan dan hampir pasti kehabisan waktu di tengah
jalan.

⚠️ **Fungsi SQL itu TIDAK menghitung skor.** `total`, `skor_komponen`,
`jml_terisi`, dan `jml_indikator` disalin apa adanya bersama seluruh nilai yang
melahirkannya, jadi angkanya identik tanpa perlu meniru mesin skoring ke dalam
SQL. Meniru berarti punya dua sumber kebenaran untuk angka yang sudah
diverifikasi 0-mismatch terhadap Excel, dan cepat atau lambat yang satu akan
ketinggalan. Begitu salinannya dibuka lalu diajukan, `simpanPenilaian`
menghitung ulang semuanya dari katalog. Salinan per D.I. memang lewat jalur itu
sejak awal: nilainya dituang ke state form, lalu tersimpan lewat autosave biasa.

Penanda asal salinan (mis. lencana "Disalin dari Triwulan II") **belum dibuat**,
dan itu lubang yang disadari: satu UPT bisa "menyelesaikan" 175 D.I. dalam
sekali klik tanpa ke lapangan, dan Administrator yang memverifikasi tidak punya
cara membedakannya dari hasil survei sungguhan. Penanda `massal` pada nilai per
bangunan ada persis karena alasan yang sama.

**Hijau Excel hanya untuk tombol yang menghasilkan berkas.** Varian tombol
`excel` (`--color-excel-600` = #107C41) dan `<IkonExcel>` dipakai berdua saja:
Unduh Excel di halaman Ekspor, dan Ekspor Excel di Data Aset Draf. Tombol
"Ekspor" di Rekapitulasi dan item sidebar "Ekspor Excel" sengaja tetap biru
karena keduanya cuma berpindah halaman. Dengan begitu warnanya
berfungsi sebagai janji "klik ini, berkas .xlsx turun", bukan hiasan. Lambang
Excel dibungkus `<IkonExcel>` di `components/ui` — logo Microsoft Excel asli
tidak ada di Simple Icons (ikon merek Microsoft dicabut karena lisensi), jadi
yang dipakai lambang berkas Excel Font Awesome, dan kalau suatu saat diganti
cukup satu berkas yang disunting.

**Katalog indikator ada di kode** (`src/lib/iksi/catalog.ts`), bukan dibaca DB
tiap render: form 158 indikator jadi instan dan hitungannya bisa di-test.
Tabel `indikator` tetap di-seed untuk integritas FK & pelaporan SQL.

**Sub-pohon berbobot 0 disembunyikan** dari form, bukan sekadar di-disable.

**Tidak memakai Prisma (atau ORM lain).** Isolasi antar UPT bertumpu pada RLS,
yang bekerja lewat `auth.uid()` dari sesi Supabase Auth. Prisma menyambung
langsung ke Postgres sebagai role `postgres` tanpa membawa identitas pengguna —
`auth.uid()` menjadi `NULL` dan seluruh policy tidak berfungsi. Memakainya berarti
menulis ulang semua otorisasi di kode aplikasi, dan satu query yang lupa memfilter
`upt_id` langsung membocorkan data antar UPT. Koneksi Postgres langsung hanya
dipakai skrip migrasi/verifikasi yang memang dijalankan manual oleh admin.

**Ekspor membangun sheet dari nol**, bukan menimpa berkas template — supaya
jumlah baris bisa mengikuti filter UPT tanpa merusak merge di bawah tabel.

---

## Gotcha yang sudah menggigit (jangan terulang)

1. **`src/lib/supabase/types.ts` — baris tabel harus `type`, BUKAN `interface`.**
   postgrest-js mensyaratkan `Row extends Record<string, unknown>`; interface TS
   tidak punya index signature implisit → semua hasil `.select()` ter-infer `never`.
2. **Modul di `src/lib/data/` mengimpor kode server** (`next/headers`). Helper yang
   dipakai komponen `"use client"` harus tinggal di `src/lib/tampilan.ts` yang murni.
   Kalau tidak, build gagal dengan "You're importing a module that depends on next/headers".
3. **Next 16 typed routes**: setelah menambah route, jalankan `npx next typegen`
   sebelum `tsc --noEmit`.
4. **Next 16 mendeprekasi `middleware.ts`** → sekarang `src/proxy.ts` yang mengekspor `proxy()`.
5. **Regex di string TS butuh `\\.`** — satu backslash tereskap jadi `.` (karakter apa pun).
6. **Heredoc bash + JSX** merusak backslash & gagal parse. Pakai tool Write untuk file besar.
7. `@types/node` harus `^22` (vitest 5 menolak `^20`).
8. **ExcelJS menormalkan format angka** `\-` → `-` saat baca maupun tulis. Konstanta
   `FMT_AKUNTANSI` sengaja memakai bentuk ternormalisasi agar identik dengan template.
9. **Rekap & ekspor WAJIB urut `kode`, bukan `nama`.** Template memakai urutan
   nomenklatur (33230001…33230577). Sebagian D.I. diberi kode di akhir rentang
   (mis. `33230287` = "Aji Bandunggede"), jadi mengurutkan alfabetis menggeser
   seluruh 577 baris. Diverifikasi 577/577 cocok setelah diperbaiki.
10. **Kata sandi Postgres wajib di-URL-encode** (`#` → `%23`). Tanpa itu koneksi
    putus di karakter `#` dan gagal dengan pesan autentikasi yang menyesatkan.
11. **DDL harus lewat DIRECT_URL (port 5432)**, bukan pooler mode transaction
    (6543) — `CREATE TYPE` dsb. akan gagal di sana.
12. **Policy tabel referensi memakai `to authenticated`**, jadi pengunjung yang
    belum masuk tidak bisa membaca `upt`/`indikator`/`daerah_irigasi` sama sekali.
    Itu disengaja — semua halaman butuh login.
13. **tsx memperlakukan `.ts` sebagai CJS.** Skrip dengan top-level await harus
    berekstensi `.mts`, kalau tidak gagal `ERR_REQUIRE_ASYNC_MODULE`.
14. **Login memakai USERNAME, bukan email.** Supabase Auth tetap butuh email,
    jadi email diturunkan deterministik dari username: `<username>@temanggungkab.go.id`
    (lihat `src/lib/akun.ts`). Tidak ada tabel pencarian, jadi tidak ada endpoint
    yang bisa dipakai menebak username terdaftar. Konsekuensinya tidak ada alur
    "lupa kata sandi" lewat email — pengaturan ulang dilakukan Administrator.
    **Mengubah `DOMAIN_AKUN` akan memutus SELURUH akun yang sudah ada.**
15. **Periode disimpan sebagai `Triwulan I`…`Triwulan IV`**, bukan `TW I`.
    Parameter URL-nya juga `?triwulan=`, bukan `?tw=`. Excel sumber memakai
    singkatan "TW"; sistem ini sengaja memakai kata penuh.
16. **JANGAN kirim komponen React menembus batas server → klien.** Ikon lucide
    adalah objek `forwardRef`, bukan objek biasa. `src/lib/nav.ts` karena itu
    menyimpan `ikon` sebagai kunci string, dan `Shell` (klien) yang memetakannya
    ke komponen. Bug ini LOLOS dari `npm run build`, lint, dan uji halaman
    /masuk — hanya `npm run uji-halaman` yang menangkapnya.
17. **`formData.get()` mengembalikan `null`, bukan `undefined`,** untuk field
    yang tidak dirender. Skema Zod-nya harus `.nullish()`, bukan `.optional()` —
    `optional()` menolak null sehingga SELURUH form gagal divalidasi meski
    field lain sudah benar. Ini pernah membuat tombol Masuk diam saja tanpa
    pesan apa pun. Karena itu `masuk()` kini selalu menyisakan pesan umum bila
    galat validasi tidak punya tempat tampil.
18. **`pkill` tidak mempan mematikan `next dev` di Windows.** Server basi tetap
    memegang port 3000 dan melayani kode lama, sehingga perubahan seolah tidak
    berpengaruh. `Stop-Process` pun bisa ditolak "Access is denied" bila
    prosesnya lahir dari sesi lain. Cara yang paling andal:

    ```bash
    netstat -ano | grep ":3000" | grep LISTENING   # ambil PID-nya
    taskkill //PID <pid> //F                       # garis miring ganda di Git Bash
    ```

    Garis miring ganda itu wajib: Git Bash menerjemahkan `/PID` jadi path
    Windows sebelum sampai ke `taskkill`. Alternatif lain, `npm run e2e` memang
    otomatis memakai server yang sedang berjalan.
19. **`<dialog>` + Tailwind v4 = modal menempel di kiri atas.** Preflight
    Tailwind menyetel `margin: 0` ke SEMUA elemen, padahal `<dialog>` memusatkan
    dirinya lewat `margin: auto` bawaan browser. Komponen `Dialog` karena itu
    wajib memakai kelas `m-auto`.
20. **Next memasang route announcer ber-`role="alert"`** di tingkat dokumen,
    jadi `getByRole("alert")` di Playwright selalu ambigu. Batasi ke dalam
    `<form>` atau elemen induk yang spesifik.
21. **`"404: This page could not be found."` selalu ada di payload RSC** sebagai
    batas not-found bawaan Next, bahkan pada halaman yang sukses. Jangan
    dipakai sebagai penanda galat; andalkan status HTTP.
22. **Nomor yang ditampilkan berbeda dari berkas cetak — pastikan nomor asli
    tetap bisa dicari.** Nomor aset yang tampil berformat SIKSI (golongan + UPT),
    sedangkan petugas memegang Buku Aset yang nomornya lain. Karena itu
    `kode_buku` wajib ikut disertakan di query pencarian halaman Aset, dan nomor
    draf apa adanya wajib ikut masuk `teks_cari`. Tanpa itu, petugas yang
    mengetik nomor dari bukunya akan mendapat hasil nihil dan menyimpulkan
    asetnya hilang. Aturan umumnya: apa pun yang diubah dari berkas sumber harus
    tetap bisa ditemukan lewat bentuk aslinya.
23. **`.select()` di postgrest-js harus satu literal string utuh.** Menyambung
    dengan `+` membuatnya ter-infer `string` biasa, dan seluruh baris hasilnya
    jatuh ke `GenericStringError` — galatnya muncul jauh dari penyebabnya,
    di tempat baris itu dipakai.
24. **Galat form jangan hanya lewat toast.** Halaman Masuk dulu menyuarakan
    "Username atau kata sandi salah" sebagai toast saja. Toast hilang sendiri
    dalam beberapa detik, jadi petugas yang salah ketik melihat form yang
    seolah tidak bereaksi sama sekali. Pesan galat sebuah form ditulis DI DALAM
    form, ber-`role="alert"`, dan menetap sampai percobaan berikutnya. Dua uji
    Playwright memang mencari `form [role="alert"]` dan gagal selama pesannya
    cuma toast.
25. **React mengosongkan field tak terkendali setiap form action selesai.**
    Salah ketik kata sandi berarti username ikut terhapus dan harus diketik
    ulang. Field yang harus bertahan lintas percobaan wajib dikendalikan state.
26. **Dua elemen `sticky` yang sama-sama menempel di puncak akan bertindihan.**
    Bilah tab komponen dan kepala kartu bangunan sama-sama `sticky`. Tingginya
    tidak bisa ditulis tetap karena bilah tab membungkus jadi satu sampai tiga
    baris tergantung lebar layar, dan letaknya berbeda antara layar sempit (di
    bawah header aplikasi setinggi 56px) dan layar lebar (di puncak). Tingginya
    diukur `ResizeObserver` lalu dibagikan lewat CSS variable `--bilah-tab`.
27. **`<option>` berisi lebih dari satu potong tidak terbaca `Pilihan`.**
    `Pilihan` adalah dropdown kustom: `<select>` aslinya disembunyikan dan yang
    dibaca petugas adalah tombol berisi label hasil `opsiDariAnak()`. Dulu
    label hanya diambil bila `props.children` berupa string atau angka;
    `<option>{d.nama} ({d.kode})</option>` bagi React adalah ARRAY, sehingga
    labelnya jatuh ke NILAI option. Akibatnya dropdown Daerah Irigasi di dialog
    Aset menampilkan `287` — id baris di database — bukan nama D.I.-nya.
    Datanya tetap tersimpan benar karena select aslinya utuh; yang salah hanya
    yang dibaca manusia, dan itu justru dasar keputusannya. Sekarang isi option
    dirangkai rekursif lewat `teksAnak()`.
28. **`Pilihan` di dalam `Dialog` memunculkan scrollbar dan panelnya terpotong.**
    Panel melayang `Pilihan` berposisi `absolute`, sedangkan `Dialog` menyetel
    `max-h-[calc(100dvh-2rem)] overflow-y-auto` supaya isi yang panjang tetap
    muat di layar. Elemen berposisi absolut TETAP dihitung sebagai luapan oleh
    leluhur yang bisa digulir, jadi begitu dropdown dibuka, dialognya ikut
    tumbuh: scrollbar muncul di kanan dan ujung panelnya terpotong di tepi
    dialog. Makin panjang daftarnya makin parah, dan `daftarTahun()` yang
    berisi 7 tahun sudah cukup untuk memicunya. Untuk memilih sesuatu di dalam
    dialog, pakai daftar tombol yang mengalir biasa dengan `overflow-y-auto`
    sendiri (pola `DialogBuat` dan `SalinPeriode`), bukan `Pilihan`. Di halaman
    biasa `Pilihan` tetap aman karena tidak ada leluhur yang menggulir.
