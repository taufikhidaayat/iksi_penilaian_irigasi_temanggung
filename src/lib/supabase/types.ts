/**
 * Tipe database, mengikuti supabase/migrations/0001_schema.sql.
 *
 * Ditulis manual agar proyek bisa dibuild tanpa koneksi ke Supabase.
 * Setelah project di-link, bisa diregenerasi dengan:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 *
 * PENTING: baris tabel harus `type`, bukan `interface`. postgrest-js mensyaratkan
 * `Row extends Record<string, unknown>`, dan interface TypeScript tidak punya index
 * signature implisit — memakainya membuat seluruh hasil `.select()` ter-infer `never`.
 */

export type PeranPengguna = "admin" | "upt";
export type StatusPenilaian = "draft" | "diajukan" | "disetujui" | "revisi";
export type OpsiKantongLumpur = "ada" | "tidak";
export type PeriodeTriwulan = "Triwulan I" | "Triwulan II" | "Triwulan III" | "Triwulan IV";
export type JenisAset =
  | "bendung"
  | "saluran"
  | "sadap"
  | "saluran_pelimpah"
  | "terjunan"
  | "talang"
  | "gorong_gorong"
  /** Hanya dipakai tabel draf: berkas GIS `SDY bendung Kab.dbf`. Lihat migrasi 0017. */
  | "bendung_baru"
  | "tanah_saluran"
  | "bangunan_pengaman"
  | "tanah_rumah"
  | "tanah_bangunan_saluran"
  | "tanah_saluran_ma"
  | "tanah_lambiran_sungai"
  | "tanah_lambiran_saluran"
  | "tanah_tidak_tersedia_kib"
  | "jalan_inspeksi";

export type AgregasiIndikator =
  | "leaf"
  | "weighted_children"
  | "sum_children"
  | "sum_children_div100";

export type Upt = {
  id: number;
  kode: string;
  nama: string;
  urutan: number;
};

export type Profil = {
  id: string;
  /** Identitas yang diketik saat masuk. Email di auth.users diturunkan darinya. */
  username: string;
  nama: string;
  peran: PeranPengguna;
  upt_id: number | null;
  aktif: boolean;
  created_at: string;
};

export type DaerahIrigasi = {
  id: number;
  kode: string;
  nama: string;
  kecamatan: string | null;
  desa: string | null;
  luas_baku: number | null;
  luas_potensial: number | null;
  luas_fungsional: number | null;
  upt_id: number | null;
  aktif: boolean;
};

export type Penilaian = {
  id: string;
  di_id: number;
  upt_id: number;
  tahun: number;
  triwulan: PeriodeTriwulan;
  kantong_lumpur: OpsiKantongLumpur;
  status: StatusPenilaian;
  jumlah_p3a: number | null;
  jumlah_gp3a: number | null;
  total: number | null;
  skor_komponen: Record<string, number> | null;
  jml_terisi: number | null;
  jml_indikator: number | null;
  catatan: string | null;
  dibuat_oleh: string | null;
  diajukan_pada: string | null;
  diverifikasi_oleh: string | null;
  diverifikasi_pada: string | null;
  created_at: string;
  updated_at: string;
};

export type PenilaianNilai = {
  penilaian_id: string;
  indikator_kode: string;
  /** 0..100. Pecahan untuk indikator yang dirata-rata dari banyak bangunan. */
  nilai: number;
  keterangan: string | null;
};

/**
 * Nilai kondisi satu indikator pada satu bangunan.
 *
 * Rata-ratanya disalin ke `penilaian_nilai` saat simpan, jadi mesin skoring,
 * rekap, dan ekspor tidak perlu tahu tabel ini ada.
 */
export type PenilaianAsetNilai = {
  penilaian_id: string;
  aset_id: number;
  indikator_kode: string;
  nilai: number;
  /** true bila nilainya datang dari pengisian massal, bukan diperiksa satuan. */
  massal: boolean;
};

export type ArealTerdampak = {
  penilaian_id: string;
  bangunan_utama: number;
  saluran_pembawa: number;
  bangunan_saluran_pembawa: number;
  saluran_pembuang: number;
  jalan_inspeksi: number;
  kantor_perumahan_gudang: number;
};

export type Aset = {
  id: number;
  jenis: JenisAset;
  /** Nama lapangan, mis. "BNDG.0517". Kosong untuk aset tanah. */
  nomenklatur: string | null;
  nama: string;
  /**
   * Nomor aset berformat SIKSI, dan inilah yang ditampilkan:
   * nomor buku dengan segmen golongan (ke-3) dan segmen wilayah (ke-4)
   * dibetulkan — `33.23.010306.01287.01001.2002`.
   *
   * TIDAK unik — buku sumber memuat kode berulang.
   */
  kode: string | null;
  /** Nomor asli dari Buku Aset, sebelum golongan dan wilayah dipasang. */
  kode_buku: string | null;
  di_id: number | null;
  kode_di_buku: string | null;
  nama_di_buku: string | null;
  desa: string | null;
  kecamatan: string | null;
  bangunan_hulu: string | null;
  bangunan_hilir: string | null;
  /** Panjang saluran dalam meter, dari berkas GIS. Lihat migrasi 0020. */
  panjang: number | null;
  tahun: number | null;
  seksi_buku: string | null;
  perlu_tinjau: boolean;
  alasan_tinjau: string | null;
  catatan: string | null;
  created_at: string;
  updated_at: string;
};

/** Satu berkas draf: metadata kolom, dipakai untuk menyusun ulang saat ekspor. */
export type AsetDrafBerkas = {
  jenis: JenisAset;
  nama_berkas: string;
  nama_sheet: string;
  /** Urutan nama kolom apa adanya di berkas asli. */
  kolom: string[];
  kolom_kode: string | null;
  jumlah_baris: number;
  diimpor_pada: string;
};

/** Satu baris draf. Kolomnya beda-beda tiap jenis, jadi disimpan di `data`. */
export type AsetDraf = {
  id: number;
  jenis: JenisAset;
  baris_ke: number;
  /** Nomor berformat SIKSI, sama aturannya dengan `aset.kode`. Ditampilkan. */
  kode: string | null;
  /** Nomor asli apa adanya di berkas draf. */
  kode_draf: string | null;
  di_id: number | null;
  data: Record<string, string | number | boolean | null>;
  teks_cari: string;
  /** true bila baris ini ditambah/diubah manual di aplikasi, bukan apa adanya dari impor GIS. */
  diedit_manual: boolean;
  diubah_oleh: string | null;
  diubah_pada: string | null;
};

type Tabel<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type SisipPenilaian = Omit<
  Penilaian,
  "id" | "created_at" | "updated_at" | "status" | "kantong_lumpur"
> &
  Partial<Pick<Penilaian, "id" | "status" | "kantong_lumpur">>;

type SisipAsetDraf = Omit<AsetDraf, "id" | "diedit_manual" | "diubah_oleh" | "diubah_pada"> &
  Partial<Pick<AsetDraf, "diedit_manual" | "diubah_oleh" | "diubah_pada">>;

export interface Database {
  public: {
    Tables: {
      upt: Tabel<Upt>;
      profil: Tabel<Profil>;
      daerah_irigasi: Tabel<DaerahIrigasi>;
      penilaian: Tabel<Penilaian, SisipPenilaian>;
      penilaian_nilai: Tabel<PenilaianNilai, PenilaianNilai>;
      penilaian_aset_nilai: Tabel<PenilaianAsetNilai, PenilaianAsetNilai>;
      areal_terdampak: Tabel<ArealTerdampak, ArealTerdampak>;
      aset: Tabel<Aset, Omit<Aset, "id" | "created_at" | "updated_at">>;
      aset_draf_berkas: Tabel<AsetDrafBerkas, AsetDrafBerkas>;
      aset_draf: Tabel<AsetDraf, SisipAsetDraf>;
    };
    Views: {
      ringkasan_aset: {
        Row: {
          jenis: JenisAset;
          upt_id: number | null;
          /** Jumlah baris tabel. */
          jumlah: number;
          perlu_tinjau: number;
          tanpa_di: number;
          /** Identitas berbeda; lebih kecil dari `jumlah` bila ada baris kembar. */
          jumlah_aset: number;
          /** Berapa D.I. yang diwakili jenis ini. */
          jumlah_di: number;
        };
        Relationships: [];
      };
      ringkasan_aset_draf: {
        Row: {
          jenis: JenisAset;
          /** Jumlah baris di berkas draf. */
          jumlah: number;
          /** Identitas berbeda; sama dengan `jumlah` selama tidak ada baris kembar. */
          jumlah_aset: number;
          /** Berapa D.I. yang diwakili jenis ini. */
          jumlah_di: number;
          tanpa_di: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      salin_penilaian_periode: {
        Args: {
          p_tahun_sumber: number;
          p_triwulan_sumber: PeriodeTriwulan;
          p_tahun: number;
          p_triwulan: PeriodeTriwulan;
          p_upt_id: number | null;
        };
        Returns: {
          disalin: number;
          sudah_ada: number;
          tanpa_sumber: number;
        }[];
      };
    };
    Enums: {
      peran_pengguna: PeranPengguna;
      status_penilaian: StatusPenilaian;
      opsi_kantong_lumpur: OpsiKantongLumpur;
      periode_triwulan: PeriodeTriwulan;
      agregasi_indikator: AgregasiIndikator;
      jenis_aset: JenisAset;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
