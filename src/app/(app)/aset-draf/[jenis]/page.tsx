import Link from "next/link";
import { notFound } from "next/navigation";

import { ChevronLeft } from "lucide-react";

import { TabelDraf } from "@/components/aset-draf/tabel-draf";
import { TombolUnduh } from "@/components/aset-draf/tombol-unduh";
import { KepalaHalaman } from "@/components/layout/kepala-halaman";
import { JENIS_ASET } from "@/lib/aset";
import { adalahJenisDraf } from "@/lib/aset-draf";
import { ambilSesiAdmin } from "@/lib/auth";
import { ambilDaftarDraf, ambilSatuBerkasDraf } from "@/lib/data/aset-draf";

const PER_HALAMAN = 50;

function satu(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function HalamanDrafJenis({
  params,
  searchParams,
}: PageProps<"/aset-draf/[jenis]">) {
  await ambilSesiAdmin();

  const { jenis } = await params;
  if (!adalahJenisDraf(jenis)) notFound();

  const sp = await searchParams;
  const cari = satu(sp.cari);
  const halaman = Math.max(1, Number(satu(sp.hal)) || 1);

  const berkas = await ambilSatuBerkasDraf(jenis);
  if (!berkas) notFound();

  const hasil = await ambilDaftarDraf({ jenis, cari, halaman, perHalaman: PER_HALAMAN });
  const info = JENIS_ASET[jenis];

  return (
    <>
      <Link
        href="/aset-draf"
        className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-brand-600 dark:text-slate-400"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Data Aset Draf IKSI
      </Link>

      <KepalaHalaman
        judul={info.label}
        deskripsi={`${berkas.jumlah_baris.toLocaleString("id-ID")} baris draf dari ${berkas.nama_berkas}. ${info.keterangan}.`}
        aksi={
          <TombolUnduh
            jenis={jenis}
            label={info.label}
            jumlahBaris={berkas.jumlah_baris}
            namaBerkasAsli={berkas.nama_berkas}
          />
        }
      />

      <TabelDraf
        baris={hasil.baris}
        kolom={berkas.kolom}
        kolomKode={berkas.kolom_kode}
        total={hasil.total}
        halaman={hasil.halaman}
        perHalaman={hasil.perHalaman}
        cari={cari}
      />
    </>
  );
}
