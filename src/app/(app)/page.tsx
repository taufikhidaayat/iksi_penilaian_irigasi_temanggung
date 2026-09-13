import Link from "next/link";

import { ArrowRight, CheckCircle2, ClipboardList, Gauge, MapPin } from "lucide-react";

import { GrafikKategori } from "@/components/dasbor/grafik-kategori";
import { GrafikUpt } from "@/components/dasbor/grafik-upt";
import { KartuStatistik } from "@/components/dasbor/kartu-statistik";
import { FilterPeriode } from "@/components/layout/filter-periode";
import { KepalaHalaman } from "@/components/layout/kepala-halaman";
import { BilahProgres, Kartu, KartuIsi, KartuJudul, KartuKepala, Lencana } from "@/components/ui";
import { ambilSesi } from "@/lib/auth";
import { ambilRingkasan } from "@/lib/data/ringkasan";
import { INFO_KATEGORI_IKSI, kategoriIksi } from "@/lib/iksi/scoring";
import { bacaPeriode } from "@/lib/periode";
import { formatAngka, formatPersen } from "@/lib/utils";
import { URUTAN_KATEGORI, nadaKategori } from "@/lib/tampilan";

export default async function HalamanDasbor({ searchParams }: PageProps<"/">) {
  const sesi = await ambilSesi();
  const sp = await searchParams;
  const { tahun, triwulan } = bacaPeriode(sp);

  const r = await ambilRingkasan(tahun, triwulan, sesi.isAdmin ? null : sesi.profil.upt_id);
  const persenSelesai = r.jumlahDi > 0 ? (r.selesai / r.jumlahDi) * 100 : 0;

  return (
    <>
      <KepalaHalaman
        judul={`Selamat datang, ${sesi.profil.nama.split(" ")[0]}`}
        deskripsi={
          sesi.isAdmin
            ? "Ringkasan penilaian kinerja sistem irigasi seluruh UPT Regional."
            : `Ringkasan penilaian ${sesi.upt?.nama ?? ""}.`
        }
        aksi={<FilterPeriode tahun={tahun} triwulan={triwulan} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuStatistik
          label="Daerah Irigasi"
          nilai={formatAngka(r.jumlahDi, 0)}
          satuan="D.I."
          keterangan={sesi.isAdmin ? "Seluruh kabupaten" : (sesi.upt?.nama ?? undefined)}
          ikon={MapPin}
        />
        <KartuStatistik
          label="Sudah Dinilai"
          nilai={formatAngka(r.selesai, 0)}
          satuan={`/ ${formatAngka(r.jumlahDi, 0)}`}
          keterangan={`${formatPersen(persenSelesai, 1)} dari target periode ini`}
          ikon={CheckCircle2}
          nada={persenSelesai >= 100 ? "hijau" : persenSelesai > 0 ? "kuning" : "biru"}
        />
        <KartuStatistik
          label="Rata-rata IKSI"
          nilai={r.rataIksi === null ? "–" : formatAngka(r.rataIksi, 2)}
          satuan={r.rataIksi === null ? undefined : "%"}
          keterangan={
            r.rataIksi === null
              ? "Belum ada penilaian final"
              : INFO_KATEGORI_IKSI[kategoriIksi(r.rataIksi)].label
          }
          ikon={Gauge}
          nada={
            r.rataIksi === null
              ? "biru"
              : r.rataIksi >= 80
                ? "hijau"
                : r.rataIksi >= 55
                  ? "kuning"
                  : "merah"
          }
        />
        <KartuStatistik
          label="Dalam Proses"
          nilai={formatAngka(r.jumlahPenilaian - r.selesai, 0)}
          satuan="draft"
          keterangan={`${formatAngka(r.jumlahPenilaian, 0)} penilaian dibuat`}
          ikon={ClipboardList}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Kartu>
          <KartuKepala className="flex items-center justify-between">
            <KartuJudul>Distribusi Kategori Kinerja</KartuJudul>
            <span className="text-xs text-slate-400">
              {tahun} · {triwulan}
            </span>
          </KartuKepala>
          <KartuIsi>
            <GrafikKategori distribusi={r.distribusi} />
            <dl className="mt-2 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
              {URUTAN_KATEGORI.map((k) => (
                <div key={k}>
                  <dt className="text-[11px] text-slate-500">{INFO_KATEGORI_IKSI[k].rentang}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                    {r.distribusi[k]}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      {INFO_KATEGORI_IKSI[k].singkat}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </KartuIsi>
        </Kartu>

        <Kartu>
          <KartuKepala>
            <KartuJudul>
              {sesi.isAdmin ? "Rata-rata IKSI per UPT" : "Rata-rata IKSI UPT Anda"}
            </KartuJudul>
          </KartuKepala>
          <KartuIsi>
            <GrafikUpt baris={r.perUpt} />
          </KartuIsi>
        </Kartu>
      </div>

      <Kartu className="mt-4">
        <KartuKepala className="flex items-center justify-between">
          <KartuJudul>Progres Pengisian per UPT</KartuJudul>
          <Link
            href="/rekap"
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25"
          >
            Lihat rekapitulasi
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </KartuKepala>
        <div className="scroll-halus overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-5 py-3 font-medium">UPT Regional</th>
                <th className="px-5 py-3 text-right font-medium">D.I.</th>
                <th className="px-5 py-3 text-right font-medium">Selesai</th>
                <th className="px-5 py-3 font-medium">Progres</th>
                <th className="px-5 py-3 text-right font-medium">Rata-rata IKSI</th>
                <th className="px-5 py-3 font-medium">Kategori</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {r.perUpt.map((u) => {
                const persen = u.jumlahDi > 0 ? (u.selesai / u.jumlahDi) * 100 : 0;
                const kat = u.rataIksi === null ? null : kategoriIksi(u.rataIksi);
                return (
                  <tr key={u.uptId} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3 font-medium text-slate-800">{u.nama}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                      {u.jumlahDi}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                      {u.selesai}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <BilahProgres nilai={persen} className="w-28" />
                        <span className="w-10 text-right text-xs tabular-nums text-slate-500">
                          {persen.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-slate-800">
                      {u.rataIksi === null ? "–" : formatAngka(u.rataIksi, 2)}
                    </td>
                    <td className="px-5 py-3">
                      {kat ? (
                        <Lencana nada={nadaKategori(kat)}>{INFO_KATEGORI_IKSI[kat].label}</Lencana>
                      ) : (
                        <span className="text-xs text-slate-400">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Kartu>
    </>
  );
}
