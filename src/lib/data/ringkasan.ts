import { createClient } from "@/lib/supabase/server";
import type { PeriodeTriwulan, StatusPenilaian } from "@/lib/supabase/types";

import { kategoriIksi } from "@/lib/iksi/scoring";
import type { KategoriIksi } from "@/lib/iksi/types";

export interface BarisRingkasanUpt {
  uptId: number;
  kode: string;
  nama: string;
  jumlahDi: number;
  selesai: number;
  draft: number;
  diajukan: number;
  rataIksi: number | null;
}

export interface RingkasanPeriode {
  jumlahDi: number;
  jumlahPenilaian: number;
  selesai: number;
  rataIksi: number | null;
  distribusi: Record<KategoriIksi, number>;
  perUpt: BarisRingkasanUpt[];
}

/** Status yang dianggap "sudah masuk" untuk perhitungan rata-rata. */
const STATUS_FINAL: StatusPenilaian[] = ["diajukan", "disetujui"];

export async function ambilRingkasan(
  tahun: number,
  triwulan: PeriodeTriwulan,
  uptId: number | null,
): Promise<RingkasanPeriode> {
  const supabase = await createClient();

  const [{ data: upts }, { data: diRows }, { data: penilaian }] = await Promise.all([
    supabase.from("upt").select("*").order("urutan"),
    supabase
      .from("daerah_irigasi")
      .select("id, upt_id")
      .eq("aktif", true)
      .then((r) => r),
    supabase
      .from("penilaian")
      .select("id, upt_id, status, total")
      .eq("tahun", tahun)
      .eq("triwulan", triwulan),
  ]);

  const diTerpakai = (diRows ?? []).filter((d) => uptId === null || d.upt_id === uptId);
  const penilaianTerpakai = (penilaian ?? []).filter((p) => uptId === null || p.upt_id === uptId);

  const distribusi: Record<KategoriIksi, number> = {
    SANGAT_BAIK: 0,
    BAIK: 0,
    KURANG: 0,
    JELEK: 0,
  };

  const nilaiFinal: number[] = [];
  for (const p of penilaianTerpakai) {
    if (!STATUS_FINAL.includes(p.status) || p.total === null) continue;
    nilaiFinal.push(p.total);
    distribusi[kategoriIksi(p.total)] += 1;
  }

  const perUpt: BarisRingkasanUpt[] = (upts ?? [])
    .filter((u) => uptId === null || u.id === uptId)
    .map((u) => {
      const milik = penilaianTerpakai.filter((p) => p.upt_id === u.id);
      const final = milik.filter((p) => STATUS_FINAL.includes(p.status) && p.total !== null);
      return {
        uptId: u.id,
        kode: u.kode,
        nama: u.nama,
        jumlahDi: diTerpakai.filter((d) => d.upt_id === u.id).length,
        selesai: final.length,
        draft: milik.filter((p) => p.status === "draft").length,
        diajukan: milik.filter((p) => p.status === "diajukan").length,
        rataIksi: final.length ? final.reduce((a, p) => a + (p.total ?? 0), 0) / final.length : null,
      };
    });

  return {
    jumlahDi: diTerpakai.length,
    jumlahPenilaian: penilaianTerpakai.length,
    selesai: nilaiFinal.length,
    rataIksi: nilaiFinal.length
      ? nilaiFinal.reduce((a, b) => a + b, 0) / nilaiFinal.length
      : null,
    distribusi,
    perUpt,
  };
}
