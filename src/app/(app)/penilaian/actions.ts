"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { ambilSesi } from "@/lib/auth";
import { INDIKATOR_INPUT, hitungSkor, isRelevan } from "@/lib/iksi/scoring";
import type { NilaiInput } from "@/lib/iksi/types";
import { createClient } from "@/lib/supabase/server";
import type { OpsiKantongLumpur, PeriodeTriwulan, StatusPenilaian } from "@/lib/supabase/types";

const KODE_VALID = new Set(INDIKATOR_INPUT.map((n) => n.kode));

export interface HasilAksi {
  ok: boolean;
  pesan?: string;
  id?: string;
}

/* ------------------------------------------------------------------ */
/* Buat penilaian baru                                                 */
/* ------------------------------------------------------------------ */

const SkemaBuat = z.object({
  diId: z.coerce.number().int().positive(),
  tahun: z.coerce.number().int().min(2000).max(2100),
  triwulan: z.enum(["Triwulan I", "Triwulan II", "Triwulan III", "Triwulan IV"]),
  kantongLumpur: z.enum(["ada", "tidak"]),
});

export async function buatPenilaian(_prev: HasilAksi, formData: FormData): Promise<HasilAksi> {
  const parsed = SkemaBuat.safeParse({
    diId: formData.get("diId"),
    tahun: formData.get("tahun"),
    triwulan: formData.get("triwulan"),
    kantongLumpur: formData.get("kantongLumpur"),
  });
  if (!parsed.success) return { ok: false, pesan: "Data tidak lengkap." };

  const sesi = await ambilSesi();
  const supabase = await createClient();

  const { data: di } = await supabase
    .from("daerah_irigasi")
    .select("id, upt_id")
    .eq("id", parsed.data.diId)
    .single();

  if (!di?.upt_id) return { ok: false, pesan: "Daerah irigasi tidak valid." };
  if (!sesi.isAdmin && di.upt_id !== sesi.profil.upt_id) {
    return { ok: false, pesan: "Daerah irigasi ini bukan wilayah UPT Anda." };
  }

  const { data, error } = await supabase
    .from("penilaian")
    .insert({
      di_id: di.id,
      upt_id: di.upt_id,
      tahun: parsed.data.tahun,
      triwulan: parsed.data.triwulan as PeriodeTriwulan,
      kantong_lumpur: parsed.data.kantongLumpur as OpsiKantongLumpur,
      status: "draft",
      jumlah_p3a: null,
      jumlah_gp3a: null,
      total: null,
      skor_komponen: null,
      jml_terisi: 0,
      jml_indikator: null,
      catatan: null,
      dibuat_oleh: sesi.id,
      diajukan_pada: null,
      diverifikasi_oleh: null,
      diverifikasi_pada: null,
    })
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      pesan:
        error.code === "23505"
          ? "Penilaian untuk D.I. dan periode ini sudah ada."
          : "Gagal membuat penilaian.",
    };
  }

  revalidatePath("/penilaian");
  return { ok: true, id: data.id };
}

/* ------------------------------------------------------------------ */
/* Simpan nilai                                                        */
/* ------------------------------------------------------------------ */

const SkemaSimpan = z.object({
  id: z.string().uuid(),
  kantongLumpur: z.enum(["ada", "tidak"]),
  jumlahP3a: z.number().int().min(0).nullable(),
  jumlahGp3a: z.number().int().min(0).nullable(),
  catatan: z.string().max(2000).nullable(),
  nilai: z.record(z.string(), z.number().int().min(0).max(100).nullable()),
  keterangan: z.record(z.string(), z.string().max(500)).optional(),
  areal: z
    .object({
      bangunan_utama: z.number().min(0),
      saluran_pembawa: z.number().min(0),
      bangunan_saluran_pembawa: z.number().min(0),
      saluran_pembuang: z.number().min(0),
      jalan_inspeksi: z.number().min(0),
      kantor_perumahan_gudang: z.number().min(0),
    })
    .nullable()
    .optional(),
});

export type MuatanSimpan = z.input<typeof SkemaSimpan>;

/**
 * Simpan seluruh isian penilaian sekaligus, lalu bekukan skor hasil hitung.
 *
 * Skor sengaja dihitung ulang di server dari katalog — tidak mempercayai angka
 * kiriman klien — supaya rekap dan ekspor tidak bisa dimanipulasi dari browser.
 */
export async function simpanPenilaian(muatan: MuatanSimpan): Promise<HasilAksi> {
  const parsed = SkemaSimpan.safeParse(muatan);
  if (!parsed.success) return { ok: false, pesan: "Data isian tidak valid." };

  const { id, kantongLumpur, jumlahP3a, jumlahGp3a, catatan, nilai, keterangan, areal } =
    parsed.data;

  const supabase = await createClient();

  const { data: penilaian } = await supabase
    .from("penilaian")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!penilaian) return { ok: false, pesan: "Penilaian tidak ditemukan." };

  const sesi = await ambilSesi();
  if (!sesi.isAdmin && !["draft", "revisi"].includes(penilaian.status)) {
    return { ok: false, pesan: "Penilaian sudah diajukan dan tidak bisa diubah." };
  }

  // Buang kode yang tidak dikenal atau tidak relevan bagi skenario kantong lumpur.
  const bersih: NilaiInput = {};
  for (const [kode, v] of Object.entries(nilai)) {
    if (!KODE_VALID.has(kode) || v === null || v === undefined) continue;
    const node = INDIKATOR_INPUT.find((n) => n.kode === kode);
    if (!node || !isRelevan(node, kantongLumpur)) continue;
    bersih[kode] = v;
  }

  const skor = hitungSkor(bersih, kantongLumpur);
  const skorKomponen = Object.fromEntries(
    skor.komponen.map((k) => [k.nomor, Number(k.nilai.toFixed(4))]),
  );

  const { error: errHeader } = await supabase
    .from("penilaian")
    .update({
      kantong_lumpur: kantongLumpur as OpsiKantongLumpur,
      jumlah_p3a: jumlahP3a,
      jumlah_gp3a: jumlahGp3a,
      catatan,
      total: Number(skor.total.toFixed(3)),
      skor_komponen: skorKomponen,
      jml_terisi: skor.terisi,
      jml_indikator: skor.totalIndikator,
    })
    .eq("id", id);

  if (errHeader) return { ok: false, pesan: "Gagal menyimpan ringkasan penilaian." };

  // Ganti seluruh baris nilai: paling sederhana dan menjamin kode yang
  // dihapus (mis. karena kantong lumpur berubah) ikut hilang.
  const { error: errHapus } = await supabase
    .from("penilaian_nilai")
    .delete()
    .eq("penilaian_id", id);
  if (errHapus) return { ok: false, pesan: "Gagal memperbarui nilai indikator." };

  const baris = Object.entries(bersih).map(([kode, v]) => ({
    penilaian_id: id,
    indikator_kode: kode,
    nilai: v as number,
    keterangan: keterangan?.[kode]?.trim() || null,
  }));

  if (baris.length) {
    const { error } = await supabase.from("penilaian_nilai").insert(baris);
    if (error) return { ok: false, pesan: "Gagal menyimpan nilai indikator." };
  }

  if (areal) {
    const { error } = await supabase
      .from("areal_terdampak")
      .upsert({ penilaian_id: id, ...areal }, { onConflict: "penilaian_id" });
    if (error) return { ok: false, pesan: "Gagal menyimpan areal terdampak." };
  }

  revalidatePath(`/penilaian/${id}`);
  revalidatePath("/penilaian");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Alur status                                                         */
/* ------------------------------------------------------------------ */

const TRANSISI: Record<StatusPenilaian, StatusPenilaian[]> = {
  draft: ["diajukan"],
  revisi: ["diajukan"],
  diajukan: ["disetujui", "revisi"],
  disetujui: ["revisi"],
};

export async function ubahStatus(id: string, tujuan: StatusPenilaian): Promise<HasilAksi> {
  const sesi = await ambilSesi();
  const supabase = await createClient();

  const { data: penilaian } = await supabase
    .from("penilaian")
    .select("id, status, jml_terisi, jml_indikator")
    .eq("id", id)
    .maybeSingle();

  if (!penilaian) return { ok: false, pesan: "Penilaian tidak ditemukan." };

  if (!TRANSISI[penilaian.status]?.includes(tujuan)) {
    return { ok: false, pesan: "Perubahan status tidak diizinkan." };
  }

  // Verifikasi (menyetujui / mengembalikan) hanya untuk admin.
  if ((tujuan === "disetujui" || tujuan === "revisi") && !sesi.isAdmin) {
    return { ok: false, pesan: "Hanya Administrator yang dapat memverifikasi." };
  }

  if (tujuan === "diajukan") {
    const { jml_terisi, jml_indikator } = penilaian;
    if (!jml_indikator || (jml_terisi ?? 0) < jml_indikator) {
      const sisa = (jml_indikator ?? 0) - (jml_terisi ?? 0);
      return {
        ok: false,
        pesan: `Masih ada ${sisa} indikator yang belum dinilai. Lengkapi dulu sebelum mengajukan.`,
      };
    }
  }

  const sekarang = new Date().toISOString();
  const { error } = await supabase
    .from("penilaian")
    .update({
      status: tujuan,
      diajukan_pada: tujuan === "diajukan" ? sekarang : undefined,
      diverifikasi_oleh: tujuan === "disetujui" ? sesi.id : undefined,
      diverifikasi_pada: tujuan === "disetujui" ? sekarang : undefined,
    })
    .eq("id", id);

  if (error) return { ok: false, pesan: "Gagal mengubah status." };

  revalidatePath(`/penilaian/${id}`);
  revalidatePath("/penilaian");
  return { ok: true };
}

export async function hapusPenilaian(id: string): Promise<HasilAksi> {
  const supabase = await createClient();
  const { error } = await supabase.from("penilaian").delete().eq("id", id);
  if (error) return { ok: false, pesan: "Gagal menghapus penilaian." };
  revalidatePath("/penilaian");
  return { ok: true };
}

/**
 * "Ulangi Penilaian" — bukan cuma menghapus, tapi langsung mengganti dengan
 * draf kosong baru untuk D.I. dan periode yang sama, supaya UPT bisa mengisi
 * ulang dari nol tanpa harus balik ke daftar dan buka dialog "Buat Penilaian"
 * lagi. Baris lama harus dihapus lebih dulu (bukan belakangan) karena
 * `(di_id, tahun, triwulan)` unik — insert akan ditolak selama baris lama
 * masih ada.
 */
export async function ulangiPenilaian(id: string): Promise<HasilAksi> {
  const supabase = await createClient();
  const sesi = await ambilSesi();

  const { data: lama } = await supabase
    .from("penilaian")
    .select("di_id, upt_id, tahun, triwulan, kantong_lumpur")
    .eq("id", id)
    .maybeSingle();
  if (!lama) return { ok: false, pesan: "Penilaian tidak ditemukan." };

  const { error: errHapus } = await supabase.from("penilaian").delete().eq("id", id);
  if (errHapus) return { ok: false, pesan: "Gagal menghapus penilaian lama." };

  const { data: baru, error: errBuat } = await supabase
    .from("penilaian")
    .insert({
      di_id: lama.di_id,
      upt_id: lama.upt_id,
      tahun: lama.tahun,
      triwulan: lama.triwulan,
      kantong_lumpur: lama.kantong_lumpur,
      status: "draft",
      jumlah_p3a: null,
      jumlah_gp3a: null,
      total: null,
      skor_komponen: null,
      jml_terisi: 0,
      jml_indikator: null,
      catatan: null,
      dibuat_oleh: sesi.id,
      diajukan_pada: null,
      diverifikasi_oleh: null,
      diverifikasi_pada: null,
    })
    .select("id")
    .single();

  // Penilaian lama sudah terlanjur hilang di sini — beri tahu apa adanya
  // supaya pengguna tahu harus membuat penilaian baru secara manual lewat
  // "Buat Penilaian", bukan diam-diam kehilangan datanya tanpa penjelasan.
  if (errBuat || !baru) {
    return {
      ok: false,
      pesan: "Penilaian lama sudah terhapus, tetapi draf baru gagal dibuat. Buat penilaian baru secara manual.",
    };
  }

  revalidatePath("/penilaian");
  return { ok: true, id: baru.id };
}
