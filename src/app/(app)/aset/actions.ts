"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { ambilSesi } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { JenisAset } from "@/lib/supabase/types";

export interface HasilAset {
  ok: boolean;
  pesan?: string;
}

const JENIS = [
  "bendung",
  "saluran",
  "sadap",
  "saluran_pelimpah",
  "terjunan",
  "talang",
  "gorong_gorong",
  "tanah_saluran",
  "bangunan_pengaman",
  "tanah_rumah",
  "tanah_bangunan_saluran",
  "tanah_saluran_ma",
  "tanah_lambiran_sungai",
  "tanah_lambiran_saluran",
  "tanah_tidak_tersedia_kib",
  "jalan_inspeksi",
] as const;

const kosongJadiNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v;

const SkemaAset = z.object({
  jenis: z.enum(JENIS),
  nama: z.string().trim().min(1, "Nama aset wajib diisi.").max(200),
  nomenklatur: z.preprocess(kosongJadiNull, z.string().max(60).nullable()),
  // Nomor aset sengaja tidak dipaksa unik: buku sumber memuat kode berulang.
  kode: z.preprocess(
    kosongJadiNull,
    z
      .string()
      .max(60)
      .regex(/^[0-9.\s]+$/, "Nomor aset hanya boleh angka dan titik.")
      .nullable(),
  ),
  diId: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().positive().nullable(),
  ),
  desa: z.preprocess(kosongJadiNull, z.string().max(120).nullable()),
  kecamatan: z.preprocess(kosongJadiNull, z.string().max(120).nullable()),
  bangunanHulu: z.preprocess(kosongJadiNull, z.string().max(120).nullable()),
  bangunanHilir: z.preprocess(kosongJadiNull, z.string().max(120).nullable()),
  tahun: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(1900).max(2100).nullable(),
  ),
  catatan: z.preprocess(kosongJadiNull, z.string().max(1000).nullable()),
  /** Dicentang bila petugas menganggap datanya sudah beres. */
  sudahDitinjau: z.boolean().optional(),
});

export type MuatanAset = z.input<typeof SkemaAset>;

/** Memastikan pengguna berhak menyentuh D.I. tujuan. */
async function bolehAtasDi(diId: number | null): Promise<boolean> {
  const sesi = await ambilSesi();
  if (sesi.isAdmin) return true;
  if (diId === null) return false; // aset tanpa D.I. hanya boleh diurus admin
  const supabase = await createClient();
  const { data } = await supabase
    .from("daerah_irigasi")
    .select("upt_id")
    .eq("id", diId)
    .maybeSingle();
  return data?.upt_id === sesi.profil.upt_id;
}

function keBaris(m: z.output<typeof SkemaAset>) {
  return {
    jenis: m.jenis as JenisAset,
    nama: m.nama,
    nomenklatur: m.nomenklatur,
    kode: m.kode ? m.kode.replace(/\s+/g, "") : null,
    di_id: m.diId,
    desa: m.desa,
    kecamatan: m.kecamatan,
    bangunan_hulu: m.bangunanHulu,
    bangunan_hilir: m.bangunanHilir,
    tahun: m.tahun,
    catatan: m.catatan,
  };
}

export async function simpanAset(id: number, muatan: MuatanAset): Promise<HasilAset> {
  const parsed = SkemaAset.safeParse(muatan);
  if (!parsed.success) {
    return { ok: false, pesan: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  if (!(await bolehAtasDi(parsed.data.diId))) {
    return { ok: false, pesan: "Aset ini di luar wilayah UPT Anda." };
  }

  const supabase = await createClient();
  const baris = keBaris(parsed.data);

  const { error } = await supabase
    .from("aset")
    .update({
      ...baris,
      // Menandai selesai ditinjau sekaligus membersihkan alasannya.
      ...(parsed.data.sudahDitinjau ? { perlu_tinjau: false, alasan_tinjau: null } : {}),
    })
    .eq("id", id);

  if (error) return { ok: false, pesan: `Gagal menyimpan: ${error.message}` };

  revalidatePath("/aset");
  return { ok: true };
}

export async function tambahAset(muatan: MuatanAset): Promise<HasilAset> {
  const parsed = SkemaAset.safeParse(muatan);
  if (!parsed.success) {
    return { ok: false, pesan: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  if (parsed.data.diId === null) {
    return { ok: false, pesan: "Aset baru wajib ditautkan ke sebuah Daerah Irigasi." };
  }
  if (!(await bolehAtasDi(parsed.data.diId))) {
    return { ok: false, pesan: "Daerah irigasi ini bukan wilayah UPT Anda." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("aset").insert({
    ...keBaris(parsed.data),
    kode_di_buku: null,
    nama_di_buku: null,
    seksi_buku: null,
    perlu_tinjau: false,
    alasan_tinjau: null,
  });

  if (error) return { ok: false, pesan: `Gagal menambah aset: ${error.message}` };

  revalidatePath("/aset");
  return { ok: true };
}

export async function hapusAset(id: number): Promise<HasilAset> {
  const sesi = await ambilSesi();
  const supabase = await createClient();

  const { data: aset } = await supabase.from("aset").select("di_id").eq("id", id).maybeSingle();
  if (!aset) return { ok: false, pesan: "Aset tidak ditemukan." };
  if (!sesi.isAdmin) {
    return { ok: false, pesan: "Hanya Administrator yang dapat menghapus aset." };
  }

  const { error } = await supabase.from("aset").delete().eq("id", id);
  if (error) return { ok: false, pesan: `Gagal menghapus: ${error.message}` };

  revalidatePath("/aset");
  return { ok: true };
}
