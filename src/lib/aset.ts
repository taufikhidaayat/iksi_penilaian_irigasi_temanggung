import type { JenisAset } from "@/lib/supabase/types";

/**
 * Label dan konteks tiap jenis aset irigasi.
 *
 * Mengikuti Tabel 2.2 "Daftar Kodefikasi Tipe Bangunan Irigasi" pada
 * Buku Aset Irigasi 2026. `kodeTipe` adalah segmen tipe pada nomor aset
 * (mis. `33.23.010306.0538.[01]001.2002` → 01 = Bendung).
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
  sadap: {
    label: "Bangunan Sadap / Bagi",
    singkat: "Sadap",
    kodeTipe: "02",
    seksi: "3.3",
    keterangan: "Pengatur dan pembagi debit air ke saluran",
    punyaNomenklatur: true,
  },
  saluran: {
    label: "Saluran Irigasi",
    singkat: "Saluran",
    kodeTipe: "03",
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
    kodeTipe: "—",
    seksi: "4.6",
    keterangan: "Tanah yang belum memiliki Kartu Inventaris Barang",
    punyaNomenklatur: false,
  },
  jalan_inspeksi: {
    label: "Jalan Inspeksi",
    singkat: "Jalan Insp.",
    kodeTipe: "—",
    seksi: "4.7",
    keterangan: "Tanah jalan inspeksi jaringan irigasi",
    punyaNomenklatur: false,
  },
};

/** Urutan tampil: bangunan dulu (BAB III), lalu aset tanah (BAB IV). */
export const URUTAN_JENIS: JenisAset[] = [
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

/** Memecah nomor aset menjadi bagian-bagian bermakna, untuk ditampilkan. */
export function uraikanKode(kode: string | null): { segmen: string; arti: string }[] | null {
  if (!kode) return null;
  const bagian = kode.split(".");
  if (bagian.length !== 6) return null;
  const arti = [
    "Provinsi Jawa Tengah",
    "Kabupaten Temanggung",
    "Urusan Bidang SDA",
    "Kode Daerah Irigasi",
    "Tipe & nomor urut objek",
    "Tahun pembangunan",
  ];
  return bagian.map((segmen, i) => ({ segmen, arti: arti[i] }));
}
