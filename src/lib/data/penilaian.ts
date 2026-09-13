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

import type { NilaiInput } from "@/lib/iksi/types";

export interface PenilaianLengkap {
  penilaian: Penilaian;
  di: DaerahIrigasi;
  upt: Upt | null;
  nilai: NilaiInput;
  keterangan: Record<string, string>;
  areal: ArealTerdampak | null;
}

export async function ambilPenilaian(id: string): Promise<PenilaianLengkap | null> {
  const supabase = await createClient();

  const { data: penilaian } = await supabase
    .from("penilaian")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!penilaian) return null;

  const [{ data: di }, { data: upt }, { data: baris }, { data: areal }] = await Promise.all([
    supabase.from("daerah_irigasi").select("*").eq("id", penilaian.di_id).single(),
    supabase.from("upt").select("*").eq("id", penilaian.upt_id).maybeSingle(),
    supabase
      .from("penilaian_nilai")
      .select("indikator_kode, nilai, keterangan")
      .eq("penilaian_id", id),
    supabase.from("areal_terdampak").select("*").eq("penilaian_id", id).maybeSingle(),
  ]);

  if (!di) return null;

  const nilai: NilaiInput = {};
  const keterangan: Record<string, string> = {};
  for (const b of (baris ?? []) as Pick<
    PenilaianNilai,
    "indikator_kode" | "nilai" | "keterangan"
  >[]) {
    nilai[b.indikator_kode] = b.nilai;
    if (b.keterangan) keterangan[b.indikator_kode] = b.keterangan;
  }

  return { penilaian, di, upt, nilai, keterangan, areal: areal ?? null };
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
