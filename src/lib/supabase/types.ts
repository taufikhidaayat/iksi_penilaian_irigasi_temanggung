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
  nilai: number;
  keterangan: string | null;
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
  /** Nomor aset spasial. TIDAK unik — buku sumber memuat kode berulang. */
  kode: string | null;
  di_id: number | null;
  kode_di_buku: string | null;
  nama_di_buku: string | null;
  desa: string | null;
  kecamatan: string | null;
  bangunan_hulu: string | null;
  bangunan_hilir: string | null;
  tahun: number | null;
  seksi_buku: string | null;
  perlu_tinjau: boolean;
  alasan_tinjau: string | null;
  catatan: string | null;
  created_at: string;
  updated_at: string;
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

export interface Database {
  public: {
    Tables: {
      upt: Tabel<Upt>;
      profil: Tabel<Profil>;
      daerah_irigasi: Tabel<DaerahIrigasi>;
      penilaian: Tabel<Penilaian, SisipPenilaian>;
      penilaian_nilai: Tabel<PenilaianNilai, PenilaianNilai>;
      areal_terdampak: Tabel<ArealTerdampak, ArealTerdampak>;
      aset: Tabel<Aset, Omit<Aset, "id" | "created_at" | "updated_at">>;
    };
    Views: {
      ringkasan_aset: {
        Row: {
          jenis: JenisAset;
          upt_id: number | null;
          jumlah: number;
          perlu_tinjau: number;
          tanpa_di: number;
        };
        Relationships: [];
      };
    };
    Functions: { [_ in never]: never };
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
