import {
  ADALAH_KODE_DI,
  KODE_DRAF_TAK_DICARI,
  KOLOM_CARI,
  KOLOM_NOMOR_DI,
} from "@/lib/aset-draf";
import { cabangJsonb, cabangJsonbSama, cabangKolom } from "@/lib/cari";
import { createClient } from "@/lib/supabase/server";
import type { AsetDraf, AsetDrafBerkas, JenisAset } from "@/lib/supabase/types";

export interface FilterDraf {
  jenis: JenisAset;
  cari?: string;
  halaman: number;
  perHalaman: number;
}

export interface HasilDraf {
  baris: AsetDraf[];
  total: number;
  halaman: number;
  perHalaman: number;
}

/** Metadata seluruh berkas draf, untuk kartu di halaman daftar. */
export async function ambilBerkasDraf(): Promise<AsetDrafBerkas[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("aset_draf_berkas").select("*");
  return data ?? [];
}

/** Angka ringkasan satu jenis draf; bentuknya sama dengan `JumlahJenis` di menu Aset. */
export interface JumlahJenisDraf {
  jenis: JenisAset;
  jumlahAset: number;
  jumlahBaris: number;
  jumlahDi: number;
  tanpaDi: number;
}

/**
 * Jumlah aset, baris, dan D.I. tiap jenis draf.
 *
 * Dihitung Postgres lewat view `ringkasan_aset_draf` (migrasi 0019), bukan
 * dengan menarik 10.691 baris ke sini hanya untuk dihitung ulang.
 */
export async function ambilRingkasanDraf(): Promise<Map<JenisAset, JumlahJenisDraf>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ringkasan_aset_draf")
    .select("jenis, jumlah, jumlah_aset, jumlah_di, tanpa_di");

  return new Map(
    (data ?? []).map((b) => [
      b.jenis,
      {
        jenis: b.jenis,
        jumlahAset: b.jumlah_aset,
        jumlahBaris: b.jumlah,
        jumlahDi: b.jumlah_di,
        tanpaDi: b.tanpa_di,
      },
    ]),
  );
}

export async function ambilSatuBerkasDraf(jenis: JenisAset): Promise<AsetDrafBerkas | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("aset_draf_berkas")
    .select("*")
    .eq("jenis", jenis)
    .maybeSingle();
  return data ?? null;
}

/**
 * Satu halaman baris draf.
 *
 * Saluran sendirian berisi 4.669 baris dengan 29 kolom, jadi paginasi
 * dikerjakan Postgres. Mengirim semuanya ke browser hanya untuk ditampilkan
 * 50 baris sekali layar akan membuang beberapa megabyte tiap muat halaman.
 */
export async function ambilDaftarDraf(f: FilterDraf): Promise<HasilDraf> {
  const supabase = await createClient();

  let q = supabase.from("aset_draf").select("*", { count: "exact" }).eq("jenis", f.jenis);

  const cari = f.cari?.trim();
  if (cari) {
    // Kolom identitas disasar satu per satu, persis seperti menu Aset Irigasi,
    // supaya kata kunci yang sama memberi jawaban yang sama di kedua menu.
    // Susunan kolom berbeda tiap jenis, jadi daftarnya diambil dari KOLOM_CARI.
    //
    // Nomor aset ikut dicari dalam dua bentuk: `kode` yang berformat SIKSI dan
    // `kode_draf` yang apa adanya dari berkas. Petugas yang memegang berkas
    // cetak mengetik yang kedua.
    const kolom = KOLOM_CARI[f.jenis];
    if (kolom) {
      const cabang = [
        ...kolom.map((k) => cabangJsonb("data", k, cari)),
        cabangKolom("kode", cari),
      ];

      if (!KODE_DRAF_TAK_DICARI.includes(f.jenis)) cabang.push(cabangKolom("kode_draf", cari));

      // Kode D.I. 4 digit dicocokkan ke kolom nomor D.I. Di menu Aset Irigasi
      // kata kunci ini mengenai segmen ke-4 `kode_buku`; jenis yang nomor
      // bukunya tidak bisa dipercaya memakai kolom nomor D.I. sebagai gantinya,
      // supaya "0001" tetap berarti D.I. 1 di kedua menu.
      const kolomDi = KOLOM_NOMOR_DI[f.jenis];
      if (kolomDi && ADALAH_KODE_DI(cari)) {
        cabang.push(cabangJsonbSama("data", kolomDi, String(Number(cari))));
      }

      q = q.or(cabang.join(","));
    } else {
      // Jenis yang belum punya daftar kolom identitas jatuh ke `teks_cari`,
      // gabungan seluruh nilai kolom. Lebih luas, tetapi lebih baik daripada
      // kotak cari yang diam-diam tidak menemukan apa pun.
      q = q.ilike("teks_cari", `%${cari}%`);
    }
  }

  const dari = (f.halaman - 1) * f.perHalaman;
  const { data, count } = await q
    .order("baris_ke", { ascending: true })
    .range(dari, dari + f.perHalaman - 1);

  return {
    baris: data ?? [],
    total: count ?? 0,
    halaman: f.halaman,
    perHalaman: f.perHalaman,
  };
}

/**
 * Seluruh baris satu jenis, untuk ekspor.
 *
 * Diambil bertahap karena PostgREST membatasi satu permintaan pada 1.000 baris.
 */
export async function ambilSemuaDraf(jenis: JenisAset): Promise<AsetDraf[]> {
  const supabase = await createClient();
  const semua: AsetDraf[] = [];

  for (let dari = 0; ; dari += 1000) {
    const { data, error } = await supabase
      .from("aset_draf")
      .select("*")
      .eq("jenis", jenis)
      .order("baris_ke", { ascending: true })
      .range(dari, dari + 999);
    if (error) throw new Error(error.message);
    semua.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  return semua;
}
