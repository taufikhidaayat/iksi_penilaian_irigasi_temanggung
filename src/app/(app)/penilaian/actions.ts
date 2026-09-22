"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { ambilSesi } from "@/lib/auth";
import {
  INDIKATOR_PER_UNIT,
  dinilaiPerUnit,
  gabungNilai,
  indikatorUntukAset,
  type BarisNilaiAset,
  type BarisNilaiAsetTerisi,
} from "@/lib/iksi/per-bangunan";
import { INDIKATOR_INPUT, NODE_BY_KODE, hitungSkor, isRelevan } from "@/lib/iksi/scoring";
import type { NilaiInput } from "@/lib/iksi/types";
import { ambilNilaiAset, ambilPenilaian } from "@/lib/data/penilaian";
import { createClient } from "@/lib/supabase/server";
import type {
  JenisAset,
  OpsiKantongLumpur,
  PeriodeTriwulan,
  StatusPenilaian,
} from "@/lib/supabase/types";

const KODE_VALID = new Set(INDIKATOR_INPUT.map((n) => n.kode));

/**
 * Batas baris per perintah insert.
 *
 * D.I. terberat menghasilkan 5.197 baris nilai per bangunan. Mengirimnya dalam
 * satu perintah berisiko kena batas ukuran payload PostgREST, jadi dipotong.
 */
const PER_SISIPAN = 500;

/** Ukuran halaman PostgREST. Batas `max-rows` Supabase juga 1000. */
const PER_TARIKAN = 1000;

/**
 * Peta `id aset -> jenis` untuk satu D.I.
 *
 * Dipakai memeriksa bahwa tiap baris nilai per bangunan memang menunjuk aset
 * milik D.I. ini, dan indikatornya memang berlaku bagi jenis bangunan itu.
 *
 * Ditarik per halaman: satu D.I. punya sampai 1.039 aset, di atas `max-rows`
 * PostgREST yang bernilai 1000. Kalau terpotong, aset yang hilang akan dianggap
 * tidak sah dan nilainya dibuang diam-diam.
 */
async function ambilJenisAset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  diId: number,
): Promise<Map<number, JenisAset>> {
  const peta = new Map<number, JenisAset>();

  for (let dari = 0; ; dari += PER_TARIKAN) {
    const { data, error } = await supabase
      .from("aset")
      .select("id, jenis")
      .eq("di_id", diId)
      .order("id")
      .range(dari, dari + PER_TARIKAN - 1);

    if (error || !data) break;
    for (const a of data) peta.set(a.id, a.jenis);
    if (data.length < PER_TARIKAN) break;
  }

  return peta;
}

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
  return buat(parsed.data);
}

const SkemaMulai = SkemaBuat.omit({ kantongLumpur: true });

/**
 * Mulai penilaian langsung dari kartu D.I. di papan, tanpa dialog.
 *
 * Kantong lumpur sengaja tidak ditanyakan di sini. Nilainya menempel pada
 * D.I. dan tidak berubah tiap triwulan, jadi menanyakannya empat kali setahun
 * untuk jawaban yang sama cuma menambah satu langkah sebelum pengisian mulai.
 * Defaultnya "ada", sama seperti default dialog lama, dan tetap bisa diubah di
 * dalam form penilaian.
 */
export async function mulaiPenilaian(muatan: {
  diId: number;
  tahun: number;
  triwulan: PeriodeTriwulan;
}): Promise<HasilAksi> {
  const parsed = SkemaMulai.safeParse(muatan);
  if (!parsed.success) return { ok: false, pesan: "Data tidak lengkap." };
  return buat({ ...parsed.data, kantongLumpur: "ada" });
}

async function buat(muatan: z.infer<typeof SkemaBuat>): Promise<HasilAksi> {
  const sesi = await ambilSesi();
  const supabase = await createClient();

  const { data: di } = await supabase
    .from("daerah_irigasi")
    .select("id, upt_id")
    .eq("id", muatan.diId)
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
      tahun: muatan.tahun,
      triwulan: muatan.triwulan as PeriodeTriwulan,
      kantong_lumpur: muatan.kantongLumpur as OpsiKantongLumpur,
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
  /** Nilai per bangunan untuk indikator Komponen I yang dinilai per unit. */
  nilaiAset: z
    .array(
      z.object({
        asetId: z.number().int().positive(),
        indikatorKode: z.string().max(60),
        nilai: z.number().int().min(0).max(100),
        massal: z.boolean().optional(),
      }),
    )
    .max(20000)
    .optional(),
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

  const {
    id,
    kantongLumpur,
    jumlahP3a,
    jumlahGp3a,
    catatan,
    nilai,
    keterangan,
    nilaiAset,
    areal,
  } = parsed.data;

  const supabase = await createClient();

  const { data: penilaian } = await supabase
    .from("penilaian")
    .select("id, status, di_id")
    .eq("id", id)
    .maybeSingle();

  if (!penilaian) return { ok: false, pesan: "Penilaian tidak ditemukan." };

  const sesi = await ambilSesi();
  if (!sesi.isAdmin && !["draft", "revisi"].includes(penilaian.status)) {
    return { ok: false, pesan: "Penilaian sudah diajukan dan tidak bisa diubah." };
  }

  // Buang kode yang tidak dikenal atau tidak relevan bagi skenario kantong
  // lumpur. Indikator yang dinilai per bangunan juga dibuang di sini: nilainya
  // datang dari rata-rata, bukan dari ketikan, jadi kiriman klien untuk kode
  // itu tidak boleh dipercaya sama sekali.
  const bersih: NilaiInput = {};
  for (const [kode, v] of Object.entries(nilai)) {
    if (!KODE_VALID.has(kode) || v === null || v === undefined) continue;
    if (INDIKATOR_PER_UNIT.has(kode)) continue;
    const node = NODE_BY_KODE.get(kode);
    if (!node || !isRelevan(node, kantongLumpur)) continue;
    bersih[kode] = v;
  }

  // Nilai per bangunan wajib disaring terhadap register aset D.I. ini. Tanpa
  // itu, klien yang dimodifikasi bisa mengarang `asetId` atau memasangkan
  // indikator ke jenis bangunan yang tidak berhak, dan skor yang dibekukan
  // jadi bisa dimanipulasi dari browser.
  // `nilaiAset` tidak dikirim sama sekali berarti pemanggil tidak menyentuh
  // penilaian per bangunan, jadi baris yang sudah tersimpan DIPERTAHANKAN dan
  // hanya dibaca untuk menghitung skor. Membedakan ini dari array kosong itu
  // penting: array kosong berarti "hapus semua", dan kalau keduanya disamakan,
  // satu simpan dari bagian form yang lain akan memusnahkan ribuan baris
  // pemeriksaan tanpa ada yang meminta.
  const menyentuhAset = nilaiAset !== undefined;

  let barisAset: BarisNilaiAset[];
  if (menyentuhAset) {
    const asetDi = await ambilJenisAset(supabase, penilaian.di_id);

    // Dihitung sekali per jenis, bukan per baris: D.I. terberat mengirim ribuan
    // baris dan membangun ulang daftarnya tiap kali jelas sia-sia.
    const izin = new Map<JenisAset, ReadonlySet<string>>();
    const indikatorSah = (jenis: JenisAset): ReadonlySet<string> => {
      let s = izin.get(jenis);
      if (!s) {
        s = new Set(indikatorUntukAset(jenis, kantongLumpur));
        izin.set(jenis, s);
      }
      return s;
    };

    barisAset = [];
    for (const b of nilaiAset) {
      const jenis = asetDi.get(b.asetId);
      if (!jenis || !dinilaiPerUnit(jenis)) continue;
      if (!indikatorSah(jenis).has(b.indikatorKode)) continue;
      barisAset.push(b);
    }
  } else {
    barisAset = await ambilNilaiAset(supabase, id);
  }

  const skor = hitungSkor(gabungNilai(bersih, barisAset), kantongLumpur);
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

  // Nilai yang disimpan adalah hasil gabungan: agregat apa adanya, per-unit
  // sudah berupa rata-rata. Dibulatkan ke 3 desimal mengikuti lebar kolom.
  const gabungan = gabungNilai(bersih, barisAset);
  const baris = Object.entries(gabungan)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([kode, v]) => ({
      penilaian_id: id,
      indikator_kode: kode,
      nilai: Number((v as number).toFixed(3)),
      keterangan: keterangan?.[kode]?.trim() || null,
    }));

  if (baris.length) {
    const { error } = await supabase.from("penilaian_nilai").insert(baris);
    if (error) return { ok: false, pesan: "Gagal menyimpan nilai indikator." };
  }

  // Ganti seluruh baris nilai per bangunan, dengan alasan yang sama seperti di
  // atas: bangunan yang dihapus dari register, atau indikator yang tidak lagi
  // relevan karena kantong lumpur berubah, harus ikut hilang. Hanya dikerjakan
  // bila pemanggil memang mengirim `nilaiAset`.
  if (menyentuhAset) {
    const { error: errHapusAset } = await supabase
      .from("penilaian_aset_nilai")
      .delete()
      .eq("penilaian_id", id);
    if (errHapusAset) return { ok: false, pesan: "Gagal memperbarui nilai per bangunan." };

    for (let i = 0; i < barisAset.length; i += PER_SISIPAN) {
      const potongan = barisAset.slice(i, i + PER_SISIPAN).map((b) => ({
        penilaian_id: id,
        aset_id: b.asetId,
        indikator_kode: b.indikatorKode,
        nilai: b.nilai as number,
        massal: b.massal ?? false,
      }));
      const { error } = await supabase.from("penilaian_aset_nilai").insert(potongan);
      if (error) return { ok: false, pesan: "Gagal menyimpan nilai per bangunan." };
    }
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

/* ------------------------------------------------------------------ */
/* Salin seluruh periode                                               */
/* ------------------------------------------------------------------ */

const SkemaSalinPeriode = z.object({
  tahunSumber: z.coerce.number().int().min(2000).max(2100),
  triwulanSumber: z.enum(["Triwulan I", "Triwulan II", "Triwulan III", "Triwulan IV"]),
  tahun: z.coerce.number().int().min(2000).max(2100),
  triwulan: z.enum(["Triwulan I", "Triwulan II", "Triwulan III", "Triwulan IV"]),
  /** Diabaikan untuk petugas UPT: lingkupnya selalu dipaksa ke UPT-nya sendiri. */
  uptId: z.coerce.number().int().positive().nullish(),
});

export interface HasilSalinPeriode extends HasilAksi {
  disalin?: number;
  sudahAda?: number;
  tanpaSumber?: number;
}

/**
 * Menyalin seluruh penilaian satu periode ke periode lain sekaligus.
 *
 * Pekerjaan beratnya ada di fungsi SQL `salin_penilaian_periode` (migrasi
 * 0021), bukan di sini: satu UPT bisa berarti puluhan ribu baris nilai per
 * bangunan, dan memindahkannya lewat PostgREST satu per satu pasti melewati
 * batas waktu. Yang dikerjakan di sini hanya menentukan lingkup UPT-nya.
 */
export async function salinPeriode(
  muatan: z.input<typeof SkemaSalinPeriode>,
): Promise<HasilSalinPeriode> {
  const parsed = SkemaSalinPeriode.safeParse(muatan);
  if (!parsed.success) return { ok: false, pesan: "Periode tidak valid." };

  const { tahunSumber, triwulanSumber, tahun, triwulan, uptId } = parsed.data;
  if (tahunSumber === tahun && triwulanSumber === triwulan) {
    return { ok: false, pesan: "Periode sumber dan periode tujuan tidak boleh sama." };
  }

  const sesi = await ambilSesi();
  const supabase = await createClient();

  // RLS sudah menutup jalan ke UPT lain, tetapi lingkupnya tetap ditentukan di
  // sini supaya angka laporannya benar: hitungan "belum ada sumbernya" membaca
  // `daerah_irigasi` yang memang boleh dibaca semua UPT.
  const lingkupUpt = sesi.isAdmin ? (uptId ?? null) : sesi.profil.upt_id;

  const { data, error } = await supabase.rpc("salin_penilaian_periode", {
    p_tahun_sumber: tahunSumber,
    p_triwulan_sumber: triwulanSumber as PeriodeTriwulan,
    p_tahun: tahun,
    p_triwulan: triwulan as PeriodeTriwulan,
    p_upt_id: lingkupUpt,
  });

  if (error) return { ok: false, pesan: "Gagal menyalin penilaian." };

  const hasil = data?.[0];
  revalidatePath("/penilaian");
  return {
    ok: true,
    disalin: hasil?.disalin ?? 0,
    sudahAda: hasil?.sudah_ada ?? 0,
    tanpaSumber: hasil?.tanpa_sumber ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Salin dari periode lain                                             */
/* ------------------------------------------------------------------ */

export interface SumberSalinan {
  kantongLumpur: OpsiKantongLumpur;
  jumlahP3a: number | null;
  jumlahGp3a: number | null;
  nilai: NilaiInput;
  keterangan: Record<string, string>;
  nilaiAset: BarisNilaiAsetTerisi[];
  areal: {
    bangunan_utama: number;
    saluran_pembawa: number;
    bangunan_saluran_pembawa: number;
    saluran_pembuang: number;
    jalan_inspeksi: number;
    kantor_perumahan_gudang: number;
  } | null;
}

/**
 * Mengambil isian penilaian lain pada D.I. yang sama, untuk ditawarkan sebagai
 * bahan salinan saat mengisi periode baru.
 *
 * Tidak menulis apa pun ke database — hasilnya dituang ke state form di
 * klien, dan tersimpan lewat jalur autosave biasa (`simpanPenilaian`), supaya
 * skor tetap dihitung ulang di server dan nilai per bangunan tetap disaring
 * ulang terhadap register aset D.I. ini, persis seperti simpan manual.
 */
export async function ambilSumberSalin(
  idTujuan: string,
  idSumber: string,
): Promise<{ ok: true; data: SumberSalinan } | { ok: false; pesan: string }> {
  const supabase = await createClient();

  const { data: tujuan } = await supabase
    .from("penilaian")
    .select("id, di_id")
    .eq("id", idTujuan)
    .maybeSingle();
  if (!tujuan) return { ok: false, pesan: "Penilaian tidak ditemukan." };

  const sumber = await ambilPenilaian(idSumber);
  if (!sumber) return { ok: false, pesan: "Penilaian sumber tidak ditemukan." };

  // D.I. yang berbeda berarti register aset dan indikator relevannya juga
  // berbeda. RLS sudah menjaga batas antar-UPT; ini menjaga batas antar-D.I.
  // dalam UPT yang sama, yang RLS sendiri tidak mengurusi.
  if (sumber.penilaian.di_id !== tujuan.di_id) {
    return { ok: false, pesan: "Sumber salinan harus dari D.I. yang sama." };
  }

  return {
    ok: true,
    data: {
      kantongLumpur: sumber.penilaian.kantong_lumpur,
      jumlahP3a: sumber.penilaian.jumlah_p3a,
      jumlahGp3a: sumber.penilaian.jumlah_gp3a,
      nilai: sumber.nilai,
      keterangan: sumber.keterangan,
      nilaiAset: sumber.nilaiAset.filter((b): b is BarisNilaiAsetTerisi => b.nilai !== null),
      areal: sumber.areal
        ? {
            bangunan_utama: Number(sumber.areal.bangunan_utama),
            saluran_pembawa: Number(sumber.areal.saluran_pembawa),
            bangunan_saluran_pembawa: Number(sumber.areal.bangunan_saluran_pembawa),
            saluran_pembuang: Number(sumber.areal.saluran_pembuang),
            jalan_inspeksi: Number(sumber.areal.jalan_inspeksi),
            kantor_perumahan_gudang: Number(sumber.areal.kantor_perumahan_gudang),
          }
        : null,
    },
  };
}
