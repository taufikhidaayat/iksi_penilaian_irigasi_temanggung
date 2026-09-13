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
    // Bintang di sisi kanan saja supaya indeks tetap terpakai untuk kode.
    const pola = `%${cari}%`;
    q = q.or(
      `nomenklatur.ilike.${pola},nama.ilike.${pola},kode.ilike.${pola},nama_di_buku.ilike.${pola}`,
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

export interface RingkasanAset {
  total: number;
  perluTinjau: number;
  tanpaDi: number;
  perJenis: { jenis: JenisAset; jumlah: number }[];
}

/** Ringkasan jumlah aset. Dihitung Postgres lewat view `ringkasan_aset`. */
export async function ambilRingkasanAset(uptId: number | null): Promise<RingkasanAset> {
  const supabase = await createClient();

  let q = supabase.from("ringkasan_aset").select("jenis, upt_id, jumlah, perlu_tinjau, tanpa_di");
  if (uptId !== null) q = q.eq("upt_id", uptId);

  const { data } = await q;
  const baris = data ?? [];

  const perJenis = new Map<JenisAset, number>();
  let total = 0;
  let perluTinjau = 0;
  let tanpaDi = 0;

  for (const b of baris) {
    total += b.jumlah;
    perluTinjau += b.perlu_tinjau;
    tanpaDi += b.tanpa_di;
    perJenis.set(b.jenis, (perJenis.get(b.jenis) ?? 0) + b.jumlah);
  }

  return {
    total,
    perluTinjau,
    tanpaDi,
    perJenis: [...perJenis.entries()]
      .map(([jenis, jumlah]) => ({ jenis, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah),
  };
}

/** Aset milik satu D.I., dikelompokkan per jenis — dipakai sebagai konteks penilaian. */
export async function ambilAsetPerDi(
  diId: number,
): Promise<{ jenis: JenisAset; daftar: Pick<Aset, "id" | "nomenklatur" | "nama" | "kode" | "desa">[] }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("aset")
    .select("id, jenis, nomenklatur, nama, kode, desa")
    .eq("di_id", diId)
    .order("jenis")
    .order("nomenklatur", { nullsFirst: false })
    .limit(2000);

  const peta = new Map<JenisAset, Pick<Aset, "id" | "nomenklatur" | "nama" | "kode" | "desa">[]>();
  for (const a of data ?? []) {
    const arr = peta.get(a.jenis);
    const item = { id: a.id, nomenklatur: a.nomenklatur, nama: a.nama, kode: a.kode, desa: a.desa };
    if (arr) arr.push(item);
    else peta.set(a.jenis, [item]);
  }
  return [...peta.entries()].map(([jenis, daftar]) => ({ jenis, daftar }));
}
