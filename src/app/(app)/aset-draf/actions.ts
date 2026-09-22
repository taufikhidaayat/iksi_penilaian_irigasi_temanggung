"use server";

import { revalidatePath } from "next/cache";

import { adalahJenisDraf } from "@/lib/aset-draf";
import { ambilSesi } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { JenisAset } from "@/lib/supabase/types";

export interface HasilAksiDraf {
  ok: boolean;
  pesan?: string;
}

export interface HasilTambahDraf extends HasilAksiDraf {
  id?: number;
}

/** Batas panjang yang sama dipakai skrip impor, lihat `scripts/impor-aset-draf.mjs`. */
const BATAS_TEKS_CARI = 20000;

function teksCariDari(data: Record<string, unknown>): string {
  return Object.values(data)
    .filter((v) => v !== null && v !== undefined && v !== "")
    .map(String)
    .join(" ")
    .slice(0, BATAS_TEKS_CARI);
}

/**
 * Mengubah satu sel pada satu baris draf.
 *
 * Kolom yang berperan sebagai nomor aset (`aset_draf_berkas.kolom_kode`)
 * ditulis ke kolom tabel `kode`, bukan ke `data` — sejalan dengan cara
 * `TabelDraf` dan ekspor Excel membacanya (lihat migrasi 0012). Kolom
 * lainnya ditulis ke `data` seperti apa adanya.
 *
 * Sengaja TIDAK menjalankan ulang `nomorAset()` atau pencocokan D.I.: itu
 * pipeline impor yang panjang dan penuh pengecualian per jenis (lihat
 * `scripts/ganti-aset-bendung.mjs`), dan meniru sebagiannya di sini berisiko
 * salah pada kasus yang belum ketahuan. Admin yang mengetik nomor tetap bisa
 * mengetiknya persis seperti yang diinginkan.
 */
export async function ubahSelDraf(
  id: number,
  kolom: string,
  nilaiBaru: string,
): Promise<HasilAksiDraf> {
  const sesi = await ambilSesi();
  if (!sesi.isAdmin) return { ok: false, pesan: "Khusus administrator." };

  const supabase = await createClient();
  const { data: baris } = await supabase
    .from("aset_draf")
    .select("jenis, data")
    .eq("id", id)
    .maybeSingle();
  if (!baris) return { ok: false, pesan: "Baris tidak ditemukan." };

  const { data: berkas } = await supabase
    .from("aset_draf_berkas")
    .select("kolom_kode")
    .eq("jenis", baris.jenis)
    .maybeSingle();

  const isiKolomKode = berkas?.kolom_kode === kolom;
  const dataBaru = isiKolomKode ? baris.data : { ...baris.data, [kolom]: nilaiBaru || null };

  const { error } = await supabase
    .from("aset_draf")
    .update({
      data: dataBaru,
      teks_cari: teksCariDari(dataBaru),
      ...(isiKolomKode ? { kode: nilaiBaru || null } : {}),
      diedit_manual: true,
      diubah_oleh: sesi.id,
      diubah_pada: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, pesan: `Gagal menyimpan: ${error.message}` };

  revalidatePath(`/aset-draf/${baris.jenis}`);
  return { ok: true };
}

/**
 * Menambah satu baris kosong pada akhir satu jenis draf, langsung bisa
 * diisi lewat sel-sel yang sama dengan baris hasil impor.
 */
export async function tambahBarisDraf(jenis: JenisAset): Promise<HasilTambahDraf> {
  const sesi = await ambilSesi();
  if (!sesi.isAdmin) return { ok: false, pesan: "Khusus administrator." };
  if (!adalahJenisDraf(jenis)) return { ok: false, pesan: "Jenis draf tidak dikenal." };

  const supabase = await createClient();

  const { data: terakhir } = await supabase
    .from("aset_draf")
    .select("baris_ke")
    .eq("jenis", jenis)
    .order("baris_ke", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: baru, error } = await supabase
    .from("aset_draf")
    .insert({
      jenis,
      baris_ke: (terakhir?.baris_ke ?? 0) + 1,
      kode: null,
      kode_draf: null,
      di_id: null,
      data: {},
      teks_cari: "",
      diedit_manual: true,
      diubah_oleh: sesi.id,
      diubah_pada: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !baru) return { ok: false, pesan: "Gagal menambah baris." };

  // `jumlah_baris` di `aset_draf_berkas` adalah cache dari saat impor, dipakai
  // kartu ringkasan dan judul halaman. Tanpa ikut disesuaikan, angkanya diam-diam
  // basi begitu ada baris yang ditambah lewat sini.
  const { data: berkas } = await supabase
    .from("aset_draf_berkas")
    .select("jumlah_baris")
    .eq("jenis", jenis)
    .maybeSingle();
  if (berkas) {
    await supabase
      .from("aset_draf_berkas")
      .update({ jumlah_baris: berkas.jumlah_baris + 1 })
      .eq("jenis", jenis);
  }

  revalidatePath(`/aset-draf/${jenis}`);
  revalidatePath("/aset-draf");
  return { ok: true, id: baru.id };
}

/** Menghapus satu baris draf. Cuma dipakai buat baris yang salah ditambah/ salah tulis. */
export async function hapusBarisDraf(id: number): Promise<HasilAksiDraf> {
  const sesi = await ambilSesi();
  if (!sesi.isAdmin) return { ok: false, pesan: "Khusus administrator." };

  const supabase = await createClient();
  const { data: baris } = await supabase
    .from("aset_draf")
    .select("jenis")
    .eq("id", id)
    .maybeSingle();
  if (!baris) return { ok: false, pesan: "Baris tidak ditemukan." };

  const { error } = await supabase.from("aset_draf").delete().eq("id", id);
  if (error) return { ok: false, pesan: `Gagal menghapus: ${error.message}` };

  const { data: berkas } = await supabase
    .from("aset_draf_berkas")
    .select("jumlah_baris")
    .eq("jenis", baris.jenis)
    .maybeSingle();
  if (berkas) {
    await supabase
      .from("aset_draf_berkas")
      .update({ jumlah_baris: Math.max(0, berkas.jumlah_baris - 1) })
      .eq("jenis", baris.jenis);
  }

  revalidatePath(`/aset-draf/${baris.jenis}`);
  revalidatePath("/aset-draf");
  return { ok: true };
}
