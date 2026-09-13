/**
 * Menghasilkan berkas Excel rekapitulasi dari data yang ada di database,
 * untuk diperiksa manual dan dibandingkan dengan template.
 *
 * Memakai kunci service-role dan MELEWATI RLS — ini skrip pemeriksaan lokal,
 * bukan bagian dari aplikasi.
 *
 * Pemakaian:
 *   npx tsx scripts/contoh-ekspor.ts [tahun] [triwulan]
 *   npx tsx scripts/contoh-ekspor.ts 2026 "Triwulan III"
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import type { BarisRekap, RekapPeriode } from "@/lib/data/rekap";
import { bangunRekapExcel, namaBerkasRekap } from "@/lib/ekspor/rekap-excel";
import { kategoriIksi } from "@/lib/iksi/scoring";
import type { PeriodeTriwulan } from "@/lib/supabase/types";

for (const baris of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const cocok = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (cocok && !process.env[cocok[1]]) {
    process.env[cocok[1]] = cocok[2].replace(/^["']|["']$/g, "");
  }
}

const tahun = Number(process.argv[2] ?? new Date().getFullYear());
const triwulan = (process.argv[3] ?? "Triwulan III") as PeriodeTriwulan;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const { data: diRows } = await sb
  .from("daerah_irigasi")
  .select("id, kode, nama, kecamatan, luas_baku, upt_id")
  .eq("aktif", true)
  .order("kode");

const { data: penilaianRows } = await sb
  .from("penilaian")
  .select("id, di_id, status, total, skor_komponen")
  .eq("tahun", tahun)
  .eq("triwulan", triwulan);

const { data: uptRows } = await sb.from("upt").select("id, nama");

const uptMap = new Map((uptRows ?? []).map((u) => [u.id, u.nama]));
const byDi = new Map((penilaianRows ?? []).map((p) => [p.di_id, p]));

const KOSONG = {
  bangunanUtama: null,
  saluranPembawa: null,
  bangunanSaluranPembawa: null,
  saluranPembuang: null,
  jalanInspeksi: null,
  kantorPerumahanGudang: null,
};

const baris: BarisRekap[] = (diRows ?? []).map((d, i) => {
  const p = byDi.get(d.id);
  const sk = (p?.skor_komponen ?? null) as Record<string, number> | null;
  return {
    no: i + 1,
    diId: d.id,
    kode: d.kode,
    nama: d.nama,
    kecamatan: d.kecamatan,
    uptNama: d.upt_id ? (uptMap.get(d.upt_id) ?? "—") : "—",
    luasBaku: d.luas_baku,
    areal: KOSONG,
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

const rekap: RekapPeriode = {
  tahun,
  triwulan,
  baris,
  total: {
    luasBaku: baris.reduce((a, b) => a + (b.luasBaku ?? 0), 0),
    areal: KOSONG,
    skor: {
      prasaranaFisik: 0,
      produktivitas: 0,
      saranaPenunjang: 0,
      organisasi: 0,
      dokumentasi: 0,
      p3a: 0,
    },
    total: 0,
  },
  jumlahDinilai: baris.filter((b) => b.total !== null).length,
  distribusi: { SANGAT_BAIK: 0, BAIK: 0, KURANG: 0, JELEK: 0 },
};

const mulai = Date.now();
const buffer = await bangunRekapExcel(rekap, {
  tandaTangan: {
    tempatTanggal: "Temanggung,        April 2026",
    jabatan: ["KEPALA DINAS PEKERJAAN UMUM", "DAN PENATAAN RUANG", "KABUPATEN TEMANGGUNG"],
    nama: "YUSUF EDI NUGROGO, S.T., M.Sc., M.Eng.",
    nip: "NIP. 19760921 200501 1 006",
  },
});

const namaBerkas = namaBerkasRekap(tahun, triwulan);
writeFileSync(namaBerkas, Buffer.from(buffer as ArrayBuffer));

console.log(`✓ ${namaBerkas}`);
console.log(`  ${baris.length} baris D.I. · ${rekap.jumlahDinilai} sudah dinilai`);
console.log(`  ${(Buffer.from(buffer as ArrayBuffer).length / 1024).toFixed(0)} KB`);
console.log(`  dibangun dalam ${Date.now() - mulai} ms`);
