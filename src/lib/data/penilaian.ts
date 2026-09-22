import { createClient } from "@/lib/supabase/server";
import type {
  ArealTerdampak,
  DaerahIrigasi,
  Penilaian,
  PenilaianNilai,
  PeriodeTriwulan,
  StatusPenilaian,
  Upt,
} from "@/lib/supabase/types";

import { INDIKATOR_PER_UNIT, type BarisNilaiAset } from "@/lib/iksi/per-bangunan";
import type { NilaiInput } from "@/lib/iksi/types";
import { TRIWULAN } from "@/lib/periode";

/** Ukuran halaman PostgREST. Batas `max-rows` Supabase juga 1000. */
const PER_TARIKAN = 1000;

export interface PenilaianLengkap {
  penilaian: Penilaian;
  di: DaerahIrigasi;
  upt: Upt | null;
  /** Nilai agregat, yaitu indikator yang diisi manual satu angka per D.I. */
  nilai: NilaiInput;
  keterangan: Record<string, string>;
  /** Nilai per bangunan untuk indikator Komponen I yang dinilai per unit. */
  nilaiAset: BarisNilaiAset[];
  areal: ArealTerdampak | null;
}

/**
 * Nilai per bangunan, ditarik per halaman sampai habis.
 *
 * Satu D.I. bisa punya ribuan baris (yang terberat 5.197), jauh di atas
 * `max-rows` PostgREST yang bernilai 1000. Menaikkan `limit` tidak menolong:
 * permintaan tetap dipenuhi sampai 1000 saja, tanpa galat. Baris yang hilang
 * akan membuat rata-rata dihitung dari sebagian bangunan saja, dan diam-diam
 * menghasilkan skor yang salah.
 */
export async function ambilNilaiAset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  penilaianId: string,
): Promise<BarisNilaiAset[]> {
  const hasil: BarisNilaiAset[] = [];

  for (let dari = 0; ; dari += PER_TARIKAN) {
    const { data, error } = await supabase
      .from("penilaian_aset_nilai")
      .select("aset_id, indikator_kode, nilai, massal")
      .eq("penilaian_id", penilaianId)
      .order("aset_id")
      .order("indikator_kode")
      .range(dari, dari + PER_TARIKAN - 1);

    if (error || !data) break;
    for (const b of data) {
      hasil.push({
        asetId: b.aset_id,
        indikatorKode: b.indikator_kode,
        nilai: b.nilai,
        massal: b.massal,
      });
    }
    if (data.length < PER_TARIKAN) break;
  }

  return hasil;
}

export async function ambilPenilaian(id: string): Promise<PenilaianLengkap | null> {
  const supabase = await createClient();

  const { data: penilaian } = await supabase
    .from("penilaian")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!penilaian) return null;

  const [{ data: di }, { data: upt }, { data: baris }, { data: areal }, nilaiAset] =
    await Promise.all([
      supabase.from("daerah_irigasi").select("*").eq("id", penilaian.di_id).single(),
      supabase.from("upt").select("*").eq("id", penilaian.upt_id).maybeSingle(),
      supabase
        .from("penilaian_nilai")
        .select("indikator_kode, nilai, keterangan")
        .eq("penilaian_id", id),
      supabase.from("areal_terdampak").select("*").eq("penilaian_id", id).maybeSingle(),
      ambilNilaiAset(supabase, id),
    ]);

  if (!di) return null;

  const nilai: NilaiInput = {};
  const keterangan: Record<string, string> = {};
  for (const b of (baris ?? []) as Pick<
    PenilaianNilai,
    "indikator_kode" | "nilai" | "keterangan"
  >[]) {
    // Indikator yang dinilai per bangunan juga tersimpan di sini (hasil
    // rata-ratanya, sering pecahan — mis. 70.417 dari tiga bangunan), demi
    // rekap & ekspor yang membaca tabel ini apa adanya. Tapi bagi form, nilai
    // yang benar datang dari `nilaiAset` dan dihitung ulang lewat
    // `gabungNilai()`; kalau pecahan ini ikut masuk ke `nilai`, ia terbawa ke
    // `nilai` sisi klien lalu ke payload simpan berikutnya — dan `nilai` di
    // skema Zod mewajibkan bilangan bulat, jadi seluruh form gagal disimpan
    // sampai halamannya dimuat ulang.
    if (INDIKATOR_PER_UNIT.has(b.indikator_kode)) continue;
    nilai[b.indikator_kode] = b.nilai;
    if (b.keterangan) keterangan[b.indikator_kode] = b.keterangan;
  }

  return { penilaian, di, upt, nilai, keterangan, nilaiAset, areal: areal ?? null };
}

export interface BarisDaftarPenilaian {
  id: string;
  diNama: string;
  diKode: string;
  kecamatan: string | null;
  uptNama: string;
  status: StatusPenilaian;
  total: number | null;
  jmlTerisi: number | null;
  jmlIndikator: number | null;
  diperbarui: string;
}

export async function ambilDaftarPenilaian(opsi: {
  tahun: number;
  triwulan: PeriodeTriwulan;
  uptId: number | null;
  status?: StatusPenilaian | null;
  cari?: string;
}): Promise<BarisDaftarPenilaian[]> {
  const supabase = await createClient();

  let q = supabase
    .from("penilaian")
    .select("id, status, total, jml_terisi, jml_indikator, updated_at, di_id, upt_id")
    .eq("tahun", opsi.tahun)
    .eq("triwulan", opsi.triwulan)
    .order("updated_at", { ascending: false });

  if (opsi.uptId !== null) q = q.eq("upt_id", opsi.uptId);
  if (opsi.status) q = q.eq("status", opsi.status);

  const { data: penilaian } = await q;
  if (!penilaian?.length) return [];

  const [{ data: diRows }, { data: uptRows }] = await Promise.all([
    supabase
      .from("daerah_irigasi")
      .select("id, kode, nama, kecamatan")
      .in("id", [...new Set(penilaian.map((p) => p.di_id))]),
    supabase.from("upt").select("id, nama"),
  ]);

  const diMap = new Map((diRows ?? []).map((d) => [d.id, d]));
  const uptMap = new Map((uptRows ?? []).map((u) => [u.id, u.nama]));

  const cari = opsi.cari?.trim().toLowerCase();

  return penilaian
    .map((p) => {
      const di = diMap.get(p.di_id);
      return {
        id: p.id,
        diNama: di?.nama ?? "—",
        diKode: di?.kode ?? "—",
        kecamatan: di?.kecamatan ?? null,
        uptNama: uptMap.get(p.upt_id) ?? "—",
        status: p.status,
        total: p.total,
        jmlTerisi: p.jml_terisi,
        jmlIndikator: p.jml_indikator,
        diperbarui: p.updated_at,
      };
    })
    .filter((b) => !cari || b.diNama.toLowerCase().includes(cari) || b.diKode.includes(cari));
}

/** D.I. yang belum punya penilaian pada periode tersebut. */
export async function ambilDiBelumDinilai(opsi: {
  tahun: number;
  triwulan: PeriodeTriwulan;
  uptId: number | null;
}): Promise<DaerahIrigasi[]> {
  const supabase = await createClient();

  let qDi = supabase.from("daerah_irigasi").select("*").eq("aktif", true).order("nama");
  if (opsi.uptId !== null) qDi = qDi.eq("upt_id", opsi.uptId);

  const [{ data: di }, { data: sudah }] = await Promise.all([
    qDi,
    supabase
      .from("penilaian")
      .select("di_id")
      .eq("tahun", opsi.tahun)
      .eq("triwulan", opsi.triwulan),
  ]);

  const dipakai = new Set((sudah ?? []).map((p) => p.di_id));
  return (di ?? []).filter((d) => !dipakai.has(d.id));
}

export interface RiwayatPenilaian {
  id: string;
  tahun: number;
  triwulan: PeriodeTriwulan;
  status: StatusPenilaian;
  total: number | null;
}

/**
 * Penilaian lain pada D.I. yang sama yang sudah punya isian, ditawarkan
 * sebagai sumber salinan saat mengisi periode baru. Diurutkan dari yang
 * paling baru, supaya triwulan sebelumnya (sumber yang paling relevan)
 * muncul duluan di dropdown.
 */
export async function ambilRiwayatPenilaianDi(
  diId: number,
  kecualikanId: string,
): Promise<RiwayatPenilaian[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("penilaian")
    .select("id, tahun, triwulan, status, total")
    .eq("di_id", diId)
    .neq("id", kecualikanId)
    .gt("jml_terisi", 0);

  return (data ?? []).sort(
    (a, b) => b.tahun - a.tahun || TRIWULAN.indexOf(b.triwulan) - TRIWULAN.indexOf(a.triwulan),
  );
}

/* ------------------------------------------------------------------ */
/* Papan penilaian                                                     */
/* ------------------------------------------------------------------ */

export interface KartuPenilaian {
  diId: number;
  kode: string;
  nama: string;
  kecamatan: string | null;
  luasBaku: number | null;
  uptNama: string;
  /** null selama D.I. ini belum punya penilaian pada periode terpilih. */
  penilaianId: string | null;
  status: StatusPenilaian | null;
  total: number | null;
  jmlTerisi: number | null;
  jmlIndikator: number | null;
  diperbarui: string | null;
}

/**
 * Menarik seluruh baris sebuah query, halaman demi halaman.
 *
 * `max-rows` PostgREST bernilai 1000 dan permintaan yang melebihinya dipenuhi
 * sebagian saja, tanpa galat. Di papan penilaian baris yang hilang tidak
 * terlihat sebagai kesalahan: D.I. yang penilaiannya terpotong akan tampil
 * sebagai "belum dinilai" padahal sudah, dan diklik akan membuat penilaian
 * kedua yang ditolak unique constraint.
 */
async function tarikSemua<T>(
  halaman: (dari: number, sampai: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const hasil: T[] = [];

  for (let dari = 0; ; dari += PER_TARIKAN) {
    const { data, error } = await halaman(dari, dari + PER_TARIKAN - 1);
    if (error || !data) break;
    hasil.push(...data);
    if (data.length < PER_TARIKAN) break;
  }

  return hasil;
}

/**
 * Seluruh D.I. pada satu periode, yang sudah dinilai maupun yang belum.
 *
 * Papan penilaian memperlakukan keduanya sebagai satu daftar, karena unit
 * kerjanya adalah "D.I. ini pada triwulan ini" entah barisnya sudah ada di
 * tabel `penilaian` atau belum. D.I. yang belum dinilai pulang dengan
 * `penilaianId` bernilai null, dan itulah yang membuat kartunya bertanda plus.
 *
 * Penyaringan teks sengaja tidak dikerjakan di sini. Seluruh daftar dikirim
 * sekali ke browser lalu disaring di sana, supaya pencarian terasa seketika
 * dan tidak menembak navigasi tiap ketikan.
 */
export async function ambilPapanPenilaian(opsi: {
  tahun: number;
  triwulan: PeriodeTriwulan;
  uptId: number | null;
}): Promise<KartuPenilaian[]> {
  const supabase = await createClient();

  const [di, penilaian, { data: uptRows }] = await Promise.all([
    tarikSemua<{
      id: number;
      kode: string;
      nama: string;
      kecamatan: string | null;
      luas_baku: number | null;
      upt_id: number | null;
    }>((dari, sampai) => {
      let q = supabase
        .from("daerah_irigasi")
        .select("id, kode, nama, kecamatan, luas_baku, upt_id")
        .eq("aktif", true);
      if (opsi.uptId !== null) q = q.eq("upt_id", opsi.uptId);
      return q.order("nama").range(dari, sampai);
    }),

    tarikSemua<{
      id: string;
      di_id: number;
      status: StatusPenilaian;
      total: number | null;
      jml_terisi: number | null;
      jml_indikator: number | null;
      updated_at: string;
    }>((dari, sampai) => {
      let q = supabase
        .from("penilaian")
        .select("id, di_id, status, total, jml_terisi, jml_indikator, updated_at")
        .eq("tahun", opsi.tahun)
        .eq("triwulan", opsi.triwulan);
      if (opsi.uptId !== null) q = q.eq("upt_id", opsi.uptId);
      return q.order("di_id").range(dari, sampai);
    }),

    supabase.from("upt").select("id, nama"),
  ]);

  const petaPenilaian = new Map(penilaian.map((p) => [p.di_id, p]));
  const petaUpt = new Map((uptRows ?? []).map((u) => [u.id, u.nama]));

  return di.map((d) => {
    const p = petaPenilaian.get(d.id);
    return {
      diId: d.id,
      kode: d.kode,
      nama: d.nama,
      kecamatan: d.kecamatan,
      luasBaku: d.luas_baku,
      uptNama: (d.upt_id !== null ? petaUpt.get(d.upt_id) : null) ?? "–",
      penilaianId: p?.id ?? null,
      status: p?.status ?? null,
      total: p?.total ?? null,
      jmlTerisi: p?.jml_terisi ?? null,
      jmlIndikator: p?.jml_indikator ?? null,
      diperbarui: p?.updated_at ?? null,
    };
  });
}
