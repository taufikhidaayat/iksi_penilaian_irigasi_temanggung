import { cabangKolom } from "@/lib/cari";
import { createClient } from "@/lib/supabase/server";
import type { Aset, JenisAset } from "@/lib/supabase/types";

export interface BarisAset extends Aset {
  diNama: string | null;
  diKode: string | null;
  uptNama: string | null;
}

export interface FilterAset {
  jenis?: JenisAset | null;
  uptId?: number | null;
  diId?: number | null;
  cari?: string;
  /** Hanya baris yang ditandai perlu ditinjau. */
  tinjau?: boolean;
  halaman: number;
  perHalaman: number;
}

export interface HasilAset {
  baris: BarisAset[];
  total: number;
  halaman: number;
  perHalaman: number;
}

/**
 * Daftar aset dengan paginasi sisi server.
 *
 * Tabel `aset` berisi >11.000 baris, jadi penyaringan dan pemotongan halaman
 * dikerjakan Postgres — bukan diambil semua lalu difilter di browser.
 */
export async function ambilDaftarAset(f: FilterAset): Promise<HasilAset> {
  const supabase = await createClient();

  let q = supabase.from("aset").select("*", { count: "exact" });

  if (f.jenis) q = q.eq("jenis", f.jenis);
  if (f.diId) q = q.eq("di_id", f.diId);
  if (f.tinjau) q = q.eq("perlu_tinjau", true);

  // Penyaring UPT butuh daftar D.I. milik UPT tersebut lebih dulu.
  if (f.uptId) {
    const { data: di } = await supabase
      .from("daerah_irigasi")
      .select("id")
      .eq("upt_id", f.uptId);
    const ids = (di ?? []).map((d) => d.id);
    if (ids.length === 0) {
      return { baris: [], total: 0, halaman: f.halaman, perHalaman: f.perHalaman };
    }
    q = q.in("di_id", ids);
  }

  const cari = f.cari?.trim();
  if (cari) {
    // `kode_buku` ikut dicari: nomor yang ditampilkan sudah berformat SIKSI,
    // sedangkan petugas yang memegang buku cetak mengetik nomor bukunya.
    // Tanpa ini pencariannya nihil dan asetnya seolah hilang.
    //
    // Desa dan kecamatan ikut dicari karena banyak aset yang namanya seragam
    // ("Saluran Sekunder"), sehingga letak justru jadi kata kunci yang wajar.
    //
    // Kata kuncinya DIKUTIP lewat `cabangKolom`. Tanpa itu, kurung dan koma
    // dibaca sebagai sintaks filter: mencari "(MA)" mengembalikan 0 baris
    // padahal ada 345, tanpa galat apa pun, sehingga asetnya seolah tidak ada.
    q = q.or(
      ["nomenklatur", "nama", "kode", "kode_buku", "nama_di_buku", "desa", "kecamatan"]
        .map((k) => cabangKolom(k, cari))
        .join(","),
    );
  }

  const dari = (f.halaman - 1) * f.perHalaman;
  const {
    data,
    count,
    error,
  } = await q
    .order("jenis")
    .order("nomenklatur", { nullsFirst: false })
    .order("id")
    .range(dari, dari + f.perHalaman - 1);

  if (error || !data) {
    return { baris: [], total: 0, halaman: f.halaman, perHalaman: f.perHalaman };
  }

  // Nama D.I. dan UPT diambil sekali untuk seluruh halaman.
  const idDi = [...new Set(data.map((a) => a.di_id).filter((x): x is number => x !== null))];
  const [{ data: diRows }, { data: uptRows }] = await Promise.all([
    idDi.length
      ? supabase.from("daerah_irigasi").select("id, kode, nama, upt_id").in("id", idDi)
      : Promise.resolve({ data: [] as { id: number; kode: string; nama: string; upt_id: number | null }[] }),
    supabase.from("upt").select("id, nama"),
  ]);

  const petaDi = new Map((diRows ?? []).map((d) => [d.id, d]));
  const petaUpt = new Map((uptRows ?? []).map((u) => [u.id, u.nama]));

  return {
    baris: data.map((a) => {
      const di = a.di_id ? petaDi.get(a.di_id) : undefined;
      return {
        ...a,
        diNama: di?.nama ?? null,
        diKode: di?.kode ?? null,
        uptNama: di?.upt_id ? (petaUpt.get(di.upt_id) ?? null) : null,
      };
    }),
    total: count ?? 0,
    halaman: f.halaman,
    perHalaman: f.perHalaman,
  };
}

/**
 * Angka ringkasan satu jenis aset.
 *
 * `jumlahAset` dan `jumlahBaris` hampir selalu sama. Keduanya dibedakan karena
 * pada tiga jenis aset tanah ada baris yang identik seluruh identitasnya, dan
 * angka yang ditonjolkan ke petugas harus berupa jumlah aset, bukan jumlah
 * baris tabel.
 */
export interface JumlahJenis {
  jenis: JenisAset;
  /** Identitas berbeda: inilah yang ditampilkan besar di kartu. */
  jumlahAset: number;
  /** Baris tabel. Ditampilkan sebagai keterangan hanya bila berbeda. */
  jumlahBaris: number;
  /** Berapa D.I. yang diwakili jenis ini. */
  jumlahDi: number;
}

export interface RingkasanAset {
  /** Total identitas berbeda, sejalan dengan `jumlahAset` per jenis. */
  total: number;
  /** Total baris tabel. */
  totalBaris: number;
  perluTinjau: number;
  tanpaDi: number;
  perJenis: JumlahJenis[];
}

/** Ringkasan jumlah aset. Dihitung Postgres lewat view `ringkasan_aset`. */
export async function ambilRingkasanAset(uptId: number | null): Promise<RingkasanAset> {
  const supabase = await createClient();

  let q = supabase
    .from("ringkasan_aset")
    .select("jenis, upt_id, jumlah, perlu_tinjau, tanpa_di, jumlah_aset, jumlah_di");
  if (uptId !== null) q = q.eq("upt_id", uptId);

  const { data } = await q;
  const baris = data ?? [];

  const perJenis = new Map<JenisAset, JumlahJenis>();
  let total = 0;
  let totalBaris = 0;
  let perluTinjau = 0;
  let tanpaDi = 0;

  for (const b of baris) {
    total += b.jumlah_aset;
    totalBaris += b.jumlah;
    perluTinjau += b.perlu_tinjau;
    tanpaDi += b.tanpa_di;

    // View dikelompokkan per (jenis, upt_id), jadi barisnya dijumlahkan di
    // sini. Aman dari hitungan ganda: sebuah D.I. hanya milik satu UPT, dan
    // identitas aset memuat `di_id` sehingga tidak mungkin muncul di dua
    // kelompok sekaligus.
    const j = perJenis.get(b.jenis) ?? {
      jenis: b.jenis,
      jumlahAset: 0,
      jumlahBaris: 0,
      jumlahDi: 0,
    };
    j.jumlahAset += b.jumlah_aset;
    j.jumlahBaris += b.jumlah;
    j.jumlahDi += b.jumlah_di;
    perJenis.set(b.jenis, j);
  }

  return {
    total,
    totalBaris,
    perluTinjau,
    tanpaDi,
    perJenis: [...perJenis.values()].sort((a, b) => b.jumlahAset - a.jumlahAset),
  };
}

/**
 * Keping identitas yang dibawa ke form penilaian.
 *
 * Sengaja lebih lengkap daripada sekadar nama: penilaian dikerjakan per
 * bangunan, jadi petugas harus bisa memastikan baris di layar adalah bangunan
 * yang sedang ia periksa. Seluruh 4.642 saluran bernama sama ("Saluran
 * Sekunder"), jadi tanpa ruas hulu–hilir dan letaknya, satu-satunya pembeda
 * tinggal nomor nomenklatur — dan itu pun ada yang kembar.
 *
 * `nama_di_buku` ikut dibawa untuk memperingatkan bila aset ini tertaut ke
 * D.I. yang namanya berbeda dari yang tertulis di buku.
 */
type AsetRingkas = Pick<
  Aset,
  | "id"
  | "nomenklatur"
  | "nama"
  | "kode"
  | "desa"
  | "kecamatan"
  | "bangunan_hulu"
  | "bangunan_hilir"
  | "panjang"
  | "nama_di_buku"
  | "perlu_tinjau"
>;

/** Ukuran halaman PostgREST. Batas `max-rows` Supabase juga 1000. */
const PER_TARIKAN = 1000;

/**
 * Aset milik satu D.I., dikelompokkan per jenis.
 *
 * Dipakai sebagai daftar kerja penilaian per bangunan, jadi kelengkapannya
 * menentukan kebenaran hitungan: bangunan yang tidak terkirim tidak akan
 * pernah dinilai dan diam-diam tidak ikut dirata-ratakan.
 *
 * ⚠️ Versi sebelumnya memakai `.limit(2000)` dan terpotong tanpa galat apa pun.
 * `max-rows` PostgREST bernilai 1000, dan `limit` di atas angka itu tidak
 * menaikkannya — permintaan hanya dipenuhi sampai 1000. D.I. `33230275` punya
 * 1.039 aset, jadi 39 di antaranya tidak pernah sampai ke browser. Karena itu
 * di sini halamannya ditarik satu per satu sampai habis, bukan sekali tarik
 * dengan limit besar.
 */
export async function ambilAsetPerDi(
  diId: number,
): Promise<{ jenis: JenisAset; daftar: AsetRingkas[] }[]> {
  const supabase = await createClient();

  const semua: (AsetRingkas & { jenis: JenisAset })[] = [];
  for (let dari = 0; ; dari += PER_TARIKAN) {
    const { data, error } = await supabase
      .from("aset")
      // Harus satu literal utuh: postgrest-js menurunkan tipe barisnya dari
      // teks select ini, dan hasil penyambungan string ter-infer jadi `string`
      // biasa sehingga seluruh baris jatuh ke tipe galat.
      .select(
        "id, jenis, nomenklatur, nama, kode, desa, kecamatan, bangunan_hulu, bangunan_hilir, panjang, nama_di_buku, perlu_tinjau",
      )
      .eq("di_id", diId)
      .order("jenis")
      .order("nomenklatur", { nullsFirst: false })
      .order("id")
      .range(dari, dari + PER_TARIKAN - 1);

    if (error || !data) break;
    semua.push(...data);
    if (data.length < PER_TARIKAN) break;
  }

  const peta = new Map<JenisAset, AsetRingkas[]>();
  for (const a of semua) {
    const arr = peta.get(a.jenis);
    const item: AsetRingkas = {
      id: a.id,
      nomenklatur: a.nomenklatur,
      nama: a.nama,
      kode: a.kode,
      desa: a.desa,
      kecamatan: a.kecamatan,
      bangunan_hulu: a.bangunan_hulu,
      bangunan_hilir: a.bangunan_hilir,
      panjang: a.panjang,
      nama_di_buku: a.nama_di_buku,
      perlu_tinjau: a.perlu_tinjau,
    };
    if (arr) arr.push(item);
    else peta.set(a.jenis, [item]);
  }
  return [...peta.entries()].map(([jenis, daftar]) => ({ jenis, daftar }));
}
