import { createClient } from "@/lib/supabase/server";
import type { PeriodeTriwulan, StatusPenilaian } from "@/lib/supabase/types";

import type { KategoriIksi } from "@/lib/iksi/types";
import { kategoriIksi } from "@/lib/iksi/scoring";

/** Satu baris tabel "Areal Terdampak dan IKSI". */
export interface BarisRekap {
  no: number;
  diId: number;
  kode: string;
  nama: string;
  kecamatan: string | null;
  uptNama: string;
  luasBaku: number | null;

  /** Areal terdampak (Ha), kolom 4–9 template. */
  areal: {
    bangunanUtama: number | null;
    saluranPembawa: number | null;
    bangunanSaluranPembawa: number | null;
    saluranPembuang: number | null;
    jalanInspeksi: number | null;
    kantorPerumahanGudang: number | null;
  };

  /** Nilai enam komponen IKSI. `null` bila D.I. belum dinilai. */
  skor: {
    prasaranaFisik: number | null;
    produktivitas: number | null;
    saranaPenunjang: number | null;
    organisasi: number | null;
    dokumentasi: number | null;
    p3a: number | null;
  };

  total: number | null;
  kategori: KategoriIksi | null;
  status: StatusPenilaian | null;
  penilaianId: string | null;
}

export interface RekapPeriode {
  tahun: number;
  triwulan: PeriodeTriwulan;
  baris: BarisRekap[];
  /** Baris "Total": luas dijumlah, skor dirata-rata (mengikuti formula template). */
  total: {
    luasBaku: number;
    areal: BarisRekap["areal"];
    skor: BarisRekap["skor"];
    total: number;
  };
  jumlahDinilai: number;
  distribusi: Record<KategoriIksi, number>;
}

export interface OpsiRekap {
  tahun: number;
  triwulan: PeriodeTriwulan;
  uptId: number | null;
  /**
   * Bila true, hanya penilaian berstatus 'disetujui' yang diambil.
   * Dipakai untuk ekspor laporan resmi.
   */
  hanyaDisetujui?: boolean;
}

const NOL_AREAL: BarisRekap["areal"] = {
  bangunanUtama: null,
  saluranPembawa: null,
  bangunanSaluranPembawa: null,
  saluranPembuang: null,
  jalanInspeksi: null,
  kantorPerumahanGudang: null,
};

/** Rata-rata yang mengabaikan nilai kosong, seperti AVERAGE di Excel. */
function rerata(nilai: (number | null)[]): number {
  const ada = nilai.filter((v): v is number => v !== null);
  return ada.length ? ada.reduce((a, b) => a + b, 0) / ada.length : 0;
}

function jumlah(nilai: (number | null)[]): number {
  return nilai.reduce<number>((a, b) => a + (b ?? 0), 0);
}

export async function ambilRekap(opsi: OpsiRekap): Promise<RekapPeriode> {
  const supabase = await createClient();

  // Urut menurut KODE, bukan nama. Template "Areal Terdampak dan IKSI" memakai
  // urutan nomenklatur (33230001…33230577) — diverifikasi identik baris demi
  // baris terhadap IKSI 2026 FINAL.xlsx. Mengurutkan alfabetis akan menggeser
  // seluruh baris karena sebagian D.I. baru diberi kode di akhir rentang.
  let qDi = supabase
    .from("daerah_irigasi")
    .select("id, kode, nama, kecamatan, luas_baku, upt_id")
    .eq("aktif", true)
    .order("kode");
  if (opsi.uptId !== null) qDi = qDi.eq("upt_id", opsi.uptId);

  let qPenilaian = supabase
    .from("penilaian")
    .select("id, di_id, status, total, skor_komponen")
    .eq("tahun", opsi.tahun)
    .eq("triwulan", opsi.triwulan);
  if (opsi.uptId !== null) qPenilaian = qPenilaian.eq("upt_id", opsi.uptId);
  if (opsi.hanyaDisetujui) qPenilaian = qPenilaian.eq("status", "disetujui");

  const [{ data: diRows }, { data: penilaianRows }, { data: uptRows }] = await Promise.all([
    qDi,
    qPenilaian,
    supabase.from("upt").select("id, nama"),
  ]);

  const penilaian = penilaianRows ?? [];
  const uptMap = new Map((uptRows ?? []).map((u) => [u.id, u.nama]));
  const penilaianByDi = new Map(penilaian.map((p) => [p.di_id, p]));

  // Areal terdampak diambil terpisah agar query utama tetap ringan.
  const idPenilaian = penilaian.map((p) => p.id);
  const arealMap = new Map<string, Record<string, number>>();
  if (idPenilaian.length) {
    const { data: arealRows } = await supabase
      .from("areal_terdampak")
      .select("*")
      .in("penilaian_id", idPenilaian);
    for (const a of arealRows ?? []) {
      arealMap.set(a.penilaian_id, a as unknown as Record<string, number>);
    }
  }

  const baris: BarisRekap[] = (diRows ?? []).map((d, i) => {
    const p = penilaianByDi.get(d.id);
    const sk = (p?.skor_komponen ?? null) as Record<string, number> | null;
    const ar = p ? arealMap.get(p.id) : undefined;

    return {
      no: i + 1,
      diId: d.id,
      kode: d.kode,
      nama: d.nama,
      kecamatan: d.kecamatan,
      uptNama: d.upt_id ? (uptMap.get(d.upt_id) ?? "—") : "—",
      luasBaku: d.luas_baku,
      areal: ar
        ? {
            bangunanUtama: Number(ar.bangunan_utama),
            saluranPembawa: Number(ar.saluran_pembawa),
            bangunanSaluranPembawa: Number(ar.bangunan_saluran_pembawa),
            saluranPembuang: Number(ar.saluran_pembuang),
            jalanInspeksi: Number(ar.jalan_inspeksi),
            kantorPerumahanGudang: Number(ar.kantor_perumahan_gudang),
          }
        : NOL_AREAL,
      skor: {
        prasaranaFisik: sk?.I ?? null,
        produktivitas: sk?.II ?? null,
        saranaPenunjang: sk?.III ?? null,
        organisasi: sk?.IV ?? null,
        dokumentasi: sk?.V ?? null,
        p3a: sk?.VI ?? null,
      },
      total: p?.total ?? null,
      kategori: p?.total != null ? kategoriIksi(p.total) : null,
      status: p?.status ?? null,
      penilaianId: p?.id ?? null,
    };
  });

  const distribusi: Record<KategoriIksi, number> = {
    SANGAT_BAIK: 0,
    BAIK: 0,
    KURANG: 0,
    JELEK: 0,
  };
  for (const b of baris) if (b.kategori) distribusi[b.kategori] += 1;

  // Baris Total mengikuti template: luas & areal dijumlahkan, skor dirata-ratakan.
  const skorTotal = {
    prasaranaFisik: rerata(baris.map((b) => b.skor.prasaranaFisik)),
    produktivitas: rerata(baris.map((b) => b.skor.produktivitas)),
    saranaPenunjang: rerata(baris.map((b) => b.skor.saranaPenunjang)),
    organisasi: rerata(baris.map((b) => b.skor.organisasi)),
    dokumentasi: rerata(baris.map((b) => b.skor.dokumentasi)),
    p3a: rerata(baris.map((b) => b.skor.p3a)),
  };

  return {
    tahun: opsi.tahun,
    triwulan: opsi.triwulan,
    baris,
    total: {
      luasBaku: jumlah(baris.map((b) => b.luasBaku)),
      areal: {
        bangunanUtama: jumlah(baris.map((b) => b.areal.bangunanUtama)),
        saluranPembawa: jumlah(baris.map((b) => b.areal.saluranPembawa)),
        bangunanSaluranPembawa: jumlah(baris.map((b) => b.areal.bangunanSaluranPembawa)),
        saluranPembuang: jumlah(baris.map((b) => b.areal.saluranPembuang)),
        jalanInspeksi: jumlah(baris.map((b) => b.areal.jalanInspeksi)),
        kantorPerumahanGudang: jumlah(baris.map((b) => b.areal.kantorPerumahanGudang)),
      },
      skor: skorTotal,
      // Template: S587 = SUM(M587:R587), yakni jumlah dari rata-rata tiap komponen.
      total: Object.values(skorTotal).reduce((a, b) => a + b, 0),
    },
    jumlahDinilai: baris.filter((b) => b.total !== null).length,
    distribusi,
  };
}
