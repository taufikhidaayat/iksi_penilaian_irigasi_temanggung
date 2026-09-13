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
npm test            # 53 test — paritas hitungan & ekspor terhadap Excel
npm run build       # build produksi
npm run lint        # eslint
npx next typegen    # regenerasi tipe route (WAJIB setelah menambah halaman)

npm run e2e             # uji browser sungguhan (Playwright): login, toast, konfirmasi
npm run db:uji          # uji end-to-end auth + isolasi RLS antar UPT
npm run uji-halaman     # render tiap halaman sebagai admin & UPT (butuh dev jalan)
npm run contoh-ekspor   # hasilkan .xlsx dari data live untuk diperiksa manual
npm run buat-akun-upt   # buat 1 akun per UPT Regional
npm run impor-aset      # impor 11.611 aset dari BUKU ASET IRIGASI WORD 2026.docx
npm run impor-aset -- --periksa   # hanya ringkasan, tanpa menulis
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
Diimpor jadi **11.611 aset**, 16 jenis, tertaut ke D.I. lewat kode:

```
33 . 23 . 010306 . 0538 . 01001 . 2002
prov  kab   SDA      D.I.  tipe+urut  tahun
```

**Kode D.I. di buku = 4 digit terakhir kode D.I. di sistem** (`0538` → `33230538`).
Diverifikasi 14/14 pada sampel; 561 dari 563 kode buku cocok dengan master 577 D.I.

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

**Jumlah aset per D.I. — alasan IKSI dinilai agregat:**

| | Total | D.I. punya | Punya >1 | Terbanyak |
|---|---:|---:|---:|---:|
| Bendung | 566 | 536 | 19 | 8 |
| Sadap | 3.036 | 419 | 364 | 68 |
| Saluran | 4.642 | 353 | 329 | 987 |

IKSI **tidak** menilai per unit. Deskriptor kondisinya berbicara soal keseluruhan
jaringan — "Setiap ruas berubah", "Sadap liar tiap 50 m", "Prosentase ... dalam
kondisi baik". Jadi tetap **satu penilaian per D.I. per triwulan**; daftar aset
hanya ditampilkan sebagai konteks di dalam form.

### Master data
- **577 D.I.** (kode 33230001–33230577), semuanya punya UPT.
- **6 UPT**: I-Temanggung(47) · II-Parakan(104) · III-Ngadirejo(175) · IV-Kranggan(75) · V-Kandangan(113) · VI-Tembarak(63)

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
npm test     →  53 passed
```

**Mesin skoring** (`scoring.test.ts`, 32 test)
- Mereproduksi **seluruh 270 nilai cache Excel**, 0 mismatch
- Total master **99.946** ✓ persis sel H9
- Semua indikator = 100 → total **100.000000** pada kedua skenario kantong lumpur
- Fixture: `src/lib/iksi/__fixtures__/master-excel.json`

**Ekspor Excel** (`rekap-excel.test.ts`, 21 test) — sebagian membandingkan
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
- [x] **Modul Aset Irigasi** — impor 11.611 aset, daftar + cari + filter + paginasi,
      tambah/ubah/hapus, penanda "perlu ditinjau"
- [x] Konteks aset di form penilaian (menjawab "bendung yang mana yang dinilai?")

- [x] Migrasi dijalankan ke Supabase (proyek `zegnkphfhvcjydjuhbrq`)
- [x] Uji end-to-end auth + isolasi RLS antar UPT (`npm run db:uji`)
- [x] Ekspor 577 baris diverifikasi baris-demi-baris terhadap template
- [x] Akun Administrator pertama dibuat

## Yang BELUM

- [ ] Ganti kata sandi admin & UPT bawaan
- [ ] Buat akun UPT sungguhan lewat menu Pengguna
- [ ] Uji alur lengkap lewat UI: isi penilaian → ajukan → admin setujui → ekspor
- [ ] Buka `IKSI_2026_TWIII.xlsx` di Excel, bandingkan visual dengan template
- [ ] Rapikan 347 aset bertanda "perlu ditinjau" lewat halaman Aset
- [ ] Putuskan nasib kode D.I. `9000` dan `0831` (tambah ke master, atau petakan ulang)
- [ ] Deploy (Vercel) + set environment variable produksi
- [ ] Rotate kata sandi database (sempat dibagikan saat setup)

---

## Keputusan desain

**Login satu pintu.** UPT ditentukan dari **akun**, bukan dropdown saat login.
Lebih aman (tidak bisa salah/iseng pilih UPT lain) dan RLS jadi satu-satunya
sumber kebenaran.

**Skor dihitung ulang di server** saat simpan — angka kiriman browser tidak
dipercaya, supaya rekap & ekspor tidak bisa dimanipulasi dari klien.

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
    berpengaruh. Matikan lewat PowerShell `Stop-Process`, atau pakai
    `npm run e2e` yang otomatis memakai server yang sedang berjalan.
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
