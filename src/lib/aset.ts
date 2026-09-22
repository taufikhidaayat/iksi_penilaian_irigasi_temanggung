import type { JenisAset } from "@/lib/supabase/types";
import { formatPanjang } from "@/lib/utils";

/**
 * Jenis aset yang benar-benar ada di Buku Aset Irigasi.
 *
 * Sama dengan enum `jenis_aset` di database, dikurangi `bendung_baru` yang
 * ditambahkan migrasi 0017 semata-mata sebagai wadah berkas draf .dbf. Jenis
 * itu tidak boleh muncul di menu Aset Irigasi maupun di form penambahan aset,
 * dan tipe ini yang menjaganya, bukan kedisiplinan orang yang mengeditnya.
 */
export type JenisAsetResmi = Exclude<JenisAset, "bendung_baru">;

/**
 * Label dan konteks tiap jenis aset irigasi.
 *
 * Mengikuti Tabel 2.2 "Daftar Kodefikasi Tipe Bangunan Irigasi" pada
 * Buku Aset Irigasi 2026. `kodeTipe` adalah segmen tipe pada nomor aset
 * (mis. `33.23.010306.01538.[01]001.2002` → 01 = Bendung).
 */
export interface InfoJenisAset {
  label: string;
  /** Bentuk singkat untuk lencana dan kolom sempit. */
  singkat: string;
  kodeTipe: string;
  /** Bab/seksi pada buku sumber. */
  seksi: string;
  keterangan: string;
  /** Aset tanah tidak memakai nomenklatur. */
  punyaNomenklatur: boolean;
}

export const JENIS_ASET: Record<JenisAset, InfoJenisAset> = {
  bendung: {
    label: "Bendung",
    singkat: "Bendung",
    kodeTipe: "01",
    seksi: "3.1",
    keterangan: "Bangunan utama pengarah/penangkap air",
    punyaNomenklatur: true,
  },
  /**
   * Bendung versi berkas GIS `SDY bendung Kab.dbf`, khusus menu Aset Draf.
   *
   * Bukan tipe bangunan tersendiri di Buku Aset, jadi `kodeTipe` dan `seksi`-nya
   * sama dengan Bendung. Dibuat terpisah semata-mata supaya dua sumber data
   * bendung bisa dibuka berdampingan tanpa yang satu menimpa yang lain.
   */
  bendung_baru: {
    label: "Bendung Baru",
    singkat: "Bendung Baru",
    kodeTipe: "01",
    seksi: "3.1",
    keterangan: "Bendung versi berkas GIS, pembanding bagi draf Bendung",
    punyaNomenklatur: true,
  },
  sadap: {
    label: "Bangunan Sadap / Bagi",
    singkat: "Sadap",
    kodeTipe: "03",
    seksi: "3.3",
    keterangan: "Pengatur dan pembagi debit air ke saluran",
    punyaNomenklatur: true,
  },
  saluran: {
    label: "Saluran Irigasi",
    singkat: "Saluran",
    kodeTipe: "02",
    seksi: "3.2",
    keterangan: "Saluran pembawa (primer / sekunder)",
    punyaNomenklatur: true,
  },
  saluran_pelimpah: {
    label: "Saluran Pelimpah",
    singkat: "Pelimpah",
    kodeTipe: "04",
    seksi: "3.4",
    keterangan: "Saluran pembuang kelebihan debit air",
    punyaNomenklatur: true,
  },
  talang: {
    label: "Talang Air",
    singkat: "Talang",
    kodeTipe: "05",
    seksi: "3.6",
    keterangan: "Bangunan pelengkap penyeberang air",
    punyaNomenklatur: true,
  },
  gorong_gorong: {
    label: "Gorong-gorong",
    singkat: "Gorong",
    kodeTipe: "06",
    seksi: "3.7",
    keterangan: "Bangunan pelintasan di bawah jalan/tanah",
    punyaNomenklatur: true,
  },
  terjunan: {
    label: "Terjunan",
    singkat: "Terjunan",
    kodeTipe: "07",
    seksi: "3.5",
    keterangan: "Bangunan peredam energi pada topografi curam",
    punyaNomenklatur: true,
  },
  bangunan_pengaman: {
    label: "Bangunan Pengaman Saluran",
    singkat: "Pengaman",
    kodeTipe: "08",
    seksi: "3.9",
    keterangan: "Talud dan bangunan pengaman saluran",
    punyaNomenklatur: false,
  },
  tanah_rumah: {
    label: "Tanah Rumah",
    singkat: "T. Rumah",
    kodeTipe: "11",
    seksi: "4.1",
    keterangan: "Lahan rumah dinas penjaga pintu air, staf, atau pos pengamatan",
    punyaNomenklatur: false,
  },
  tanah_saluran: {
    label: "Tanah Saluran",
    singkat: "T. Saluran",
    kodeTipe: "12",
    seksi: "3.8",
    keterangan: "Lahan sempadan untuk akses pemeliharaan dan pengamanan saluran",
    punyaNomenklatur: false,
  },
  tanah_bangunan_saluran: {
    label: "Tanah Bangunan Saluran",
    singkat: "T. Bang. Sal.",
    kodeTipe: "12",
    seksi: "4.2",
    keterangan: "Lahan bangunan saluran irigasi",
    punyaNomenklatur: false,
  },
  tanah_saluran_ma: {
    label: "Tanah Saluran dari Mata Air",
    singkat: "T. Sal. MA",
    kodeTipe: "13",
    seksi: "4.3",
    keterangan: "Lahan sempadan saluran yang bersumber dari mata air",
    punyaNomenklatur: false,
  },
  tanah_lambiran_sungai: {
    label: "Tanah Lambiran Sungai",
    singkat: "T. Lamb. Sungai",
    kodeTipe: "14",
    seksi: "4.4",
    keterangan: "Lahan lambiran di tepi sungai",
    punyaNomenklatur: false,
  },
  tanah_lambiran_saluran: {
    label: "Tanah Lambiran Saluran",
    singkat: "T. Lamb. Saluran",
    kodeTipe: "15",
    seksi: "4.5",
    keterangan: "Lahan lambiran di tepi saluran irigasi",
    punyaNomenklatur: false,
  },
  tanah_tidak_tersedia_kib: {
    label: "Tanah Tidak Tersedia KIB",
    singkat: "T. Tanpa KIB",
    kodeTipe: "16",
    seksi: "4.6",
    keterangan: "Tanah yang belum memiliki Kartu Inventaris Barang",
    punyaNomenklatur: false,
  },
  jalan_inspeksi: {
    label: "Jalan Inspeksi",
    singkat: "Jalan Insp.",
    kodeTipe: "17",
    seksi: "4.7",
    keterangan: "Tanah jalan inspeksi jaringan irigasi",
    punyaNomenklatur: false,
  },
};

/** Urutan tampil: bangunan dulu (BAB III), lalu aset tanah (BAB IV). */
export const URUTAN_JENIS: JenisAsetResmi[] = [
  "bendung",
  "sadap",
  "saluran",
  "saluran_pelimpah",
  "terjunan",
  "talang",
  "gorong_gorong",
  "bangunan_pengaman",
  "tanah_saluran",
  "tanah_bangunan_saluran",
  "tanah_saluran_ma",
  "tanah_lambiran_sungai",
  "tanah_lambiran_saluran",
  "tanah_rumah",
  "tanah_tidak_tersedia_kib",
  "jalan_inspeksi",
];

/**
 * Posisi sebuah jenis pada urutan tampil, untuk mengurutkan daftar aset.
 *
 * Dipakai daripada `URUTAN_JENIS.indexOf()` langsung karena indexOf
 * mengembalikan -1 untuk jenis di luar daftar, yang justru melemparnya ke
 * paling depan. Jenis seperti itu ada: `bendung_baru` hanya hidup di menu
 * Aset Draf dan tidak pernah masuk URUTAN_JENIS.
 */
export function urutanJenis(jenis: JenisAset): number {
  const i = (URUTAN_JENIS as JenisAset[]).indexOf(jenis);
  return i < 0 ? URUTAN_JENIS.length : i;
}

/** Jenis yang termasuk bangunan fisik (BAB III), bukan aset tanah. */
export const JENIS_BANGUNAN: JenisAset[] = [
  "bendung",
  "sadap",
  "saluran",
  "saluran_pelimpah",
  "terjunan",
  "talang",
  "gorong_gorong",
  "bangunan_pengaman",
];

/**
 * Sebutan yang ditampilkan untuk sebuah aset.
 * Nomenklatur didahulukan karena itulah yang dipakai petugas di lapangan;
 * nomor aset spasial terlalu panjang untuk jadi judul.
 */
export function sebutanAset(a: { nomenklatur: string | null; nama: string }): string {
  return a.nomenklatur ? `${a.nomenklatur} — ${a.nama}` : a.nama;
}

/* ===================================================================
 * Identitas bangunan saat mengisi penilaian
 *
 * Penilaian dikerjakan per bangunan, jadi petugas harus bisa memastikan
 * bangunan di layar adalah bangunan yang sedang ia periksa. Nomenklatur dan
 * nama saja TIDAK cukup:
 *
 *   - seluruh 4.642 saluran bernama sama persis, "Saluran Sekunder";
 *   - 14 D.I. punya saluran dengan nomenklatur kembar, dan 10 saluran tidak
 *     punya nomenklatur sama sekali;
 *   - nomor aset pun berulang: satu D.I. bisa punya dua saluran bernomor
 *     `...0397.02001.2002` yang sama.
 *
 * Karena itu identitas disusun dari beberapa keping sekaligus: nomenklatur,
 * nama, ruas hulu–hilir, dan letak desa/kecamatan.
 * =================================================================== */

/** Keping data yang dipakai menyusun identitas sebuah bangunan. */
export interface AsetBerlokasi {
  nomenklatur: string | null;
  nama: string;
  kode: string | null;
  desa: string | null;
  kecamatan: string | null;
  bangunan_hulu: string | null;
  bangunan_hilir: string | null;
  /** Panjang saluran dalam meter. Null untuk jenis lain dan yang belum terdata. */
  panjang?: number | null;
}

/**
 * Ruas sebuah saluran: bangunan di hulu dan di hilirnya.
 *
 * Inilah satu-satunya pembeda antar-ruas pada D.I. yang seluruh salurannya
 * bernama "Saluran Sekunder" dan berada di desa yang sama.
 */
export function ruasAset(a: Pick<AsetBerlokasi, "bangunan_hulu" | "bangunan_hilir">): string | null {
  const { bangunan_hulu: hulu, bangunan_hilir: hilir } = a;
  if (!hulu && !hilir) return null;
  return `${hulu ?? "?"} → ${hilir ?? "?"}`;
}

/** Letak aset, mis. "Watukumpul, Kec. Parakan". Null bila belum dicatat. */
export function letakAset(a: Pick<AsetBerlokasi, "desa" | "kecamatan">): string | null {
  const bagian = [a.desa, a.kecamatan ? `Kec. ${a.kecamatan}` : null].filter(Boolean);
  return bagian.length > 0 ? bagian.join(", ") : null;
}

/**
 * Seluruh keping identitas sebagai baris label–nilai, siap dirender.
 *
 * Keping yang kosong DIIKUTKAN dengan penanda, bukan dibuang: "letak belum
 * dicatat" adalah informasi yang perlu dilihat petugas — 556 gorong-gorong
 * memang tidak punya desa sama sekali, dan itu harus terlihat, bukan tersamar
 * sebagai baris yang tidak ada.
 */
export function rincianAset(a: AsetBerlokasi, jenis: JenisAset): { label: string; nilai: string; kosong?: boolean }[] {
  const rincian: { label: string; nilai: string; kosong?: boolean }[] = [];

  rincian.push({ label: "Jenis", nilai: JENIS_ASET[jenis].label });

  if (JENIS_ASET[jenis].punyaNomenklatur) {
    rincian.push(
      a.nomenklatur
        ? { label: "Nomenklatur", nilai: a.nomenklatur }
        : { label: "Nomenklatur", nilai: "belum ada", kosong: true },
    );
  }

  const ruas = ruasAset(a);
  if (ruas) rincian.push({ label: "Ruas", nilai: ruas });

  /*
   * Panjang hanya berarti bagi saluran, dan di sanalah ia paling dibutuhkan:
   * seluruh 4.642 saluran bernama sama, jadi panjang adalah salah satu dari
   * sedikit keping yang benar-benar membedakan satu ruas dari ruas lain saat
   * petugas mencocokkannya di lapangan.
   *
   * Barisnya DIIKUTKAN dengan penanda ketika kosong, sama seperti letak:
   * "belum terdata" adalah keterangan yang perlu dilihat, bukan baris yang
   * pantas dihilangkan diam-diam.
   */
  if (jenis === "saluran") {
    rincian.push(
      a.panjang === null || a.panjang === undefined
        ? { label: "Panjang", nilai: "belum terdata", kosong: true }
        : { label: "Panjang", nilai: formatPanjang(a.panjang) },
    );
  }

  const letak = letakAset(a);
  rincian.push(
    letak
      ? { label: "Letak", nilai: letak }
      : { label: "Letak", nilai: "belum dicatat", kosong: true },
  );

  rincian.push(
    a.kode
      ? { label: "Nomor aset", nilai: a.kode }
      : { label: "Nomor aset", nilai: "belum ada", kosong: true },
  );

  return rincian;
}

/**
 * Membakukan nama Daerah Irigasi untuk dibandingkan.
 *
 * Bentuknya sama persis dengan fungsi `nama_di_baku()` di database (migrasi
 * 0013), supaya penandaan di daftar kerja dan peringatan di layar tidak pernah
 * berbeda kesimpulan: huruf besar, tanpa tanda baca, tanpa awalan "DI".
 */
export function namaDiBaku(nama: string | null): string {
  return (nama ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^DI/, "");
}

/**
 * Benarkah nama D.I. di buku menunjuk D.I. yang lain?
 *
 * Aset ditautkan ke D.I. semata-mata lewat kode 4 digit pada nomor asetnya,
 * tanpa pernah mencocokkan namanya. Satu kode yang keliru di buku karena itu
 * memindahkan seluruh bangunannya ke D.I. lain tanpa ada yang tahu.
 *
 * Varian ejaan dan penyebutan yang lebih panjang ("Sirancah Pakurejo" memuat
 * "Sirancah") sengaja tidak dihitung berbeda, supaya peringatannya tetap
 * berarti dan tidak muncul di mana-mana sampai diabaikan orang.
 */
export function namaDiBerbeda(namaBuku: string | null, namaDi: string | null): boolean {
  if (!namaBuku || !namaDi) return false;
  const a = namaDiBaku(namaBuku);
  const b = namaDiBaku(namaDi);
  if (!a || !b || a === b) return false;
  return !a.includes(b) && !b.includes(a);
}

/** Bangunan yang berbagi nomenklatur dengan saudaranya di D.I. yang sama. */
export interface PenandaKembar {
  urutan: number;
  total: number;
  /**
   * Seluruh keping identitasnya pun sama — nomor aset sekalipun. Bangunan
   * seperti ini benar-benar tidak bisa dibedakan dan datanya harus dilengkapi
   * dulu sebelum hasil penilaiannya bisa dipercaya.
   */
  takTerbedakan: boolean;
}

/**
 * Penanda bagi bangunan yang nomenklaturnya dipakai bersama.
 *
 * Nomenklatur adalah yang paling menonjol di daftar, jadi ke situ pula mata
 * penilai tertuju. Begitu satu nomenklatur dipakai beberapa bangunan, daftar
 * itu menyesatkan walau sebenarnya masih bisa dibedakan lewat nomor asetnya:
 * D.I. Sandong punya 11 ruas yang sama-sama bernomenklatur `SAL.03783`,
 * sama-sama "Saluran Sekunder", sama ruasnya, dan sama desanya — pembedanya
 * hanya empat digit di tengah nomor aset.
 *
 * Karena itu kelompoknya dibentuk dari nomenklatur (atau, bagi jenis yang
 * memang tidak bernomenklatur, dari seluruh keping identitas), dan anggota
 * yang bahkan nomor asetnya kembar diberi tanda yang lebih keras.
 */
export function penandaKembar<T extends AsetBerlokasi & { id: number }>(
  daftar: readonly T[],
): Map<number, PenandaKembar> {
  const sidikPenuh = (a: T) =>
    [
      a.nomenklatur ?? "",
      a.nama,
      a.bangunan_hulu ?? "",
      a.bangunan_hilir ?? "",
      a.desa ?? "",
      a.kecamatan ?? "",
      a.kode ?? "",
    ].join("|");

  const jumlahSidik = new Map<string, number>();
  for (const a of daftar) {
    const s = sidikPenuh(a);
    jumlahSidik.set(s, (jumlahSidik.get(s) ?? 0) + 1);
  }

  const kelompok = new Map<string, T[]>();
  for (const a of daftar) {
    // Jenis tanpa nomenklatur (bangunan pengaman, seluruh aset tanah)
    // dikelompokkan lewat seluruh keping identitasnya.
    const kunci = a.nomenklatur ? `n:${a.nomenklatur}` : `s:${sidikPenuh(a)}`;
    const arr = kelompok.get(kunci);
    if (arr) arr.push(a);
    else kelompok.set(kunci, [a]);
  }

  const hasil = new Map<number, PenandaKembar>();
  for (const arr of kelompok.values()) {
    if (arr.length < 2) continue;
    arr.forEach((a, i) =>
      hasil.set(a.id, {
        urutan: i + 1,
        total: arr.length,
        takTerbedakan: (jumlahSidik.get(sidikPenuh(a)) ?? 0) > 1,
      }),
    );
  }
  return hasil;
}

/** Kode golongan pada segmen ke-3: 01 bangunan (BAB III), 02 tanah (BAB IV). */
export function kodeGolongan(jenis: JenisAset): "01" | "02" {
  return JENIS_BANGUNAN.includes(jenis) ? "01" : "02";
}

/** Segmen ke-3 utuh, mis. `020306` untuk aset tanah. */
export function segmenGolongan(jenis: JenisAset): string {
  return `${kodeGolongan(jenis)}0306`;
}

/**
 * Membetulkan segmen golongan pada sebuah nomor aset, tanpa menyentuh
 * bagian lainnya sedikit pun.
 *
 * Buku Aset menulis `010306` untuk SELURUH aset, termasuk 1.615 aset tanah,
 * sehingga golongan tidak terbaca dari nomornya. Aturan yang dipakai Dinas:
 * `01` bangunan irigasi (BAB III), `02` aset tanah (BAB IV).
 *
 * Penggantiannya memakai regex dan hanya menyasar ruas ke-3, bukan menyusun
 * ulang nomornya dari potongan. Sebabnya 13 nomor di buku punya segmen ke-4
 * dan ke-5 yang tertulis menyatu (`...0010501001.2002`); menyusun ulang akan
 * merapikan atau malah merusak bagian itu diam-diam, padahal baris tersebut
 * sudah bertanda `perlu_tinjau` dan memang harus diperiksa manusia.
 *
 * Aman dipanggil berulang, dan aman atas nomor yang golongannya sudah benar.
 * Nomor kosong atau yang tidak punya tiga ruas dikembalikan apa adanya.
 */
export function terapkanGolongan(kode: string | null, jenis: JenisAset): string | null {
  if (!kode) return kode;
  if (kode.split(".").length < 3) return kode;
  return kode.replace(/^([^.]*\.[^.]*\.)[^.]*/, `$1${segmenGolongan(jenis)}`);
}

/** Wilayah pengelola sebuah aset, sebagaimana tercatat di master D.I. */
export interface WilayahAset {
  uptId: number | null;
  /** Kode D.I. 8 digit dari master, mis. `33230287`. */
  kodeDi: string | null;
}

/**
 * Memasang segmen wilayah: 2 digit UPT + 3 digit nomor D.I., mis. `01287`.
 *
 * Buku memberi nomor yang seragam se-kabupaten, sehingga siapa pengelolanya
 * tidak terbaca dari nomornya. Segmen ke-4 karena itu dibuat berbicara.
 *
 * Nomor DIBIARKAN apa adanya bila:
 *   - asetnya belum tertaut D.I., jadi UPT-nya tidak diketahui. Menebak di
 *     sini berarti memberi nomor wilayah yang salah pada aset yang justru
 *     sedang menunggu dirapikan;
 *   - nomornya bukan 6 segmen, atau segmen ke-4-nya lebih dari 5 digit. Pada
 *     13 baris, segmen ke-4 dan ke-5 tertulis menyatu di buku; menimpanya
 *     akan ikut memusnahkan segmen ke-5.
 *
 * Aman dipanggil berulang: nilainya dihitung dari master, bukan dari isi
 * nomor sebelumnya.
 */
export function terapkanWilayah(kode: string | null, wilayah: WilayahAset): string | null {
  if (!kode || wilayah.uptId === null || !wilayah.kodeDi) return kode;

  const bagian = kode.split(".");
  if (bagian.length !== 6 || bagian[3].length > 5) return kode;

  bagian[3] = segmenWilayah(wilayah.uptId, wilayah.kodeDi);
  return bagian.join(".");
}

/**
 * Nomor aset sebagaimana ditampilkan: nomor sumber dengan segmen golongan dan
 * segmen wilayah dibetulkan.
 *
 * ```
 * 33 . 23 . 010306 . 01287 . 01001 . 2002
 *              ^^      ^^ ^^
 *          golongan   UPT  nomor D.I.
 * ```
 *
 * Satu-satunya tempat aturan ini ditulis untuk aplikasi; skrip impor memakai
 * salinan aturan yang sama karena berjalan di luar bundel Next.
 */
export function nomorAset(
  kode: string | null,
  jenis: JenisAset,
  wilayah: WilayahAset | null,
): string | null {
  const bergolongan = terapkanGolongan(kode, jenis);
  return wilayah ? terapkanWilayah(bergolongan, wilayah) : bergolongan;
}

/**
 * Segmen ke-4: 2 digit UPT + 3 digit nomor D.I., mis. `01287`.
 *
 * `kodeDi` adalah kode 8 digit dari master (mis. `33230287`); yang dipakai
 * hanya nomor urutnya. Tiga digit cukup selama master berisi 577 D.I.
 */
export function segmenWilayah(uptId: number, kodeDi: string): string {
  const nomor = Number(kodeDi.slice(-4));
  return `${String(uptId).padStart(2, "0")}${String(nomor).padStart(3, "0")}`;
}

/**
 * Memecah nomor aset menjadi bagian-bagian bermakna, untuk ditampilkan.
 *
 * Yang diuraikan adalah nomor ASLI dari buku, sesuai yang dilihat petugas:
 *
 *     33 . 23 . 010306 . 0538 . 01001 . 2002
 *    prov  kab    SDA     D.I.  tipe+urut  tahun
 *
 * Nomor bentukan sistem (segmen ke-4 berisi 5 digit: 2 digit UPT + 3 digit
 * D.I.) ikut dikenali supaya data lama tetap terbaca, tetapi bukan itu yang
 * ditampilkan di mana pun.
 */
export function uraikanKode(kode: string | null): { segmen: string; arti: string }[] | null {
  if (!kode) return null;
  const bagian = kode.split(".");
  if (bagian.length !== 6) return null;

  const golongan =
    bagian[2].startsWith("01") ? "Golongan bangunan irigasi"
    : bagian[2].startsWith("02") ? "Golongan aset tanah"
    : "Urusan Bidang SDA";

  // Segmen 5 digit HANYA dibaca sebagai UPT bila dua digit awalnya memang
  // nomor UPT yang ada (01..06). Buku memuat 94 nomor yang segmennya 5 digit
  // karena salah ketik (`00172`, `90000`); membacanya sebagai "UPT Regional 0"
  // akan mengarang keterangan yang tidak ada dasarnya.
  const nomorUpt = bagian[3].length === 5 ? Number(bagian[3].slice(0, 2)) : 0;
  const wilayah =
    nomorUpt >= 1 && nomorUpt <= 6
      ? `UPT Regional ${nomorUpt} · D.I. ${bagian[3].slice(2)}`
      : bagian[3].length === 5
        ? "Kode Daerah Irigasi (tidak baku)"
        : "Kode Daerah Irigasi";

  const arti = [
    "Provinsi Jawa Tengah",
    "Kabupaten Temanggung",
    golongan,
    wilayah,
    "Tipe & nomor urut objek",
    "Tahun pembangunan",
  ];
  return bagian.map((segmen, i) => ({ segmen, arti: arti[i] }));
}
