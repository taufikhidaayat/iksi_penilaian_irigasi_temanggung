import Link from "next/link";

import { FileDown } from "lucide-react";

import { FilterPeriode } from "@/components/layout/filter-periode";
import { KepalaHalaman } from "@/components/layout/kepala-halaman";
import { TabelRekap } from "@/components/rekap/tabel-rekap";
import { Kartu, KartuIsi, Lencana, Tombol } from "@/components/ui";
import { ambilSesi } from "@/lib/auth";
import { ambilRekap } from "@/lib/data/rekap";
import { INFO_KATEGORI_IKSI, kategoriIksi } from "@/lib/iksi/scoring";
import { bacaPeriode } from "@/lib/periode";
import { createClient } from "@/lib/supabase/server";
import { URUTAN_KATEGORI, nadaKategori } from "@/lib/tampilan";
import { formatAngka } from "@/lib/utils";

import { PilihUpt } from "./pilih-upt";

export default async function HalamanRekap({ searchParams }: PageProps<"/rekap">) {
  const sesi = await ambilSesi();
  const sp = await searchParams;
  const { tahun, triwulan } = bacaPeriode(sp);

  const uptParam = (Array.isArray(sp.upt) ? sp.upt[0] : sp.upt) ?? "";
  const uptId = sesi.isAdmin ? (uptParam ? Number(uptParam) : null) : sesi.profil.upt_id;

  const supabase = await createClient();
  const [rekap, { data: daftarUpt }] = await Promise.all([
    ambilRekap({ tahun, triwulan, uptId }),
    sesi.isAdmin
      ? supabase.from("upt").select("id, nama").order("urutan")
      : Promise.resolve({ data: null }),
  ]);

  const kategoriTotal = rekap.jumlahDinilai > 0 ? kategoriIksi(rekap.total.total) : null;

  const paramEkspor = new URLSearchParams({ tahun: String(tahun), triwulan });
  if (uptId !== null) paramEkspor.set("upt", String(uptId));

  return (
    <>
      <KepalaHalaman
        judul="Rekapitulasi"
        deskripsi={`Areal terdampak dan Indeks Kinerja Sistem Irigasi · ${triwulan} ${tahun}`}
        aksi={
          <>
            {sesi.isAdmin && daftarUpt ? <PilihUpt daftar={daftarUpt} terpilih={uptParam} /> : null}
            <FilterPeriode tahun={tahun} triwulan={triwulan} />
            <Link href={`/ekspor?${paramEkspor}`}>
              <Tombol>
                <FileDown className="h-4 w-4" />
                Ekspor
              </Tombol>
            </Link>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kartu className="px-4 py-3">
          <p className="text-xs text-slate-500">Daerah Irigasi</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
            {rekap.baris.length}
          </p>
        </Kartu>
        <Kartu className="px-4 py-3">
          <p className="text-xs text-slate-500">Sudah Dinilai</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
            {rekap.jumlahDinilai}
            <span className="ml-1 text-sm font-normal text-slate-400">
              / {rekap.baris.length}
            </span>
          </p>
        </Kartu>
        <Kartu className="px-4 py-3">
          <p className="text-xs text-slate-500">Rata-rata IKSI</p>
          <p className="mt-1 flex items-center gap-2">
            <span className="text-xl font-semibold tabular-nums text-slate-900">
              {rekap.jumlahDinilai > 0 ? formatAngka(rekap.total.total, 2) : "–"}
            </span>
            {kategoriTotal ? (
              <Lencana nada={nadaKategori(kategoriTotal)}>
                {INFO_KATEGORI_IKSI[kategoriTotal].singkat}
              </Lencana>
            ) : null}
          </p>
        </Kartu>
        <Kartu className="px-4 py-3">
          <p className="text-xs text-slate-500">Distribusi Kategori</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {URUTAN_KATEGORI.map((k) => (
              <Lencana key={k} nada={nadaKategori(k)}>
                {INFO_KATEGORI_IKSI[k].singkat} {rekap.distribusi[k]}
              </Lencana>
            ))}
          </div>
        </Kartu>
      </div>

      <Kartu>
        <KartuIsi>
          <TabelRekap
            baris={rekap.baris}
            total={rekap.total}
            tampilUpt={sesi.isAdmin && uptId === null}
          />
        </KartuIsi>
      </Kartu>
    </>
  );
}
