import Link from "next/link";

import { ChevronRight } from "lucide-react";

import { FilterPeriode } from "@/components/layout/filter-periode";
import { KepalaHalaman } from "@/components/layout/kepala-halaman";
import { BarisTabel } from "@/components/penilaian/baris-tabel";
import { DialogBuat } from "@/components/penilaian/dialog-buat";
import { FilterDaftar } from "@/components/penilaian/filter-daftar";
import { BilahProgres, Kartu, KosongData, Lencana } from "@/components/ui";
import { ambilSesi } from "@/lib/auth";
import { ambilDaftarPenilaian, ambilDiBelumDinilai } from "@/lib/data/penilaian";
import { INFO_KATEGORI_IKSI, kategoriIksi } from "@/lib/iksi/scoring";
import { bacaPeriode } from "@/lib/periode";
import { createClient } from "@/lib/supabase/server";
import type { StatusPenilaian } from "@/lib/supabase/types";
import { INFO_STATUS, nadaKategori } from "@/lib/tampilan";
import { formatAngka, formatTanggal } from "@/lib/utils";

import { buatPenilaian } from "./actions";

function satu(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function HalamanDaftarPenilaian({ searchParams }: PageProps<"/penilaian">) {
  const sesi = await ambilSesi();
  const sp = await searchParams;
  const { tahun, triwulan } = bacaPeriode(sp);

  const cari = satu(sp.cari);
  const status = satu(sp.status) as StatusPenilaian | "";
  const uptTerpilih = satu(sp.upt);

  // UPT non-admin selalu terkunci ke UPT-nya sendiri.
  const uptId = sesi.isAdmin
    ? uptTerpilih
      ? Number(uptTerpilih)
      : null
    : sesi.profil.upt_id;

  const supabase = await createClient();
  const [daftar, kandidat, { data: daftarUpt }] = await Promise.all([
    ambilDaftarPenilaian({
      tahun,
      triwulan,
      uptId,
      status: status || null,
      cari,
    }),
    ambilDiBelumDinilai({ tahun, triwulan, uptId }),
    sesi.isAdmin
      ? supabase.from("upt").select("id, nama").order("urutan")
      : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <KepalaHalaman
        judul="Penilaian"
        deskripsi={`${daftar.length} penilaian pada ${triwulan} ${tahun}${
          kandidat.length ? ` · ${kandidat.length} D.I. belum dinilai` : ""
        }`}
        aksi={
          <>
            <FilterPeriode tahun={tahun} triwulan={triwulan} />
            <DialogBuat
              kandidat={kandidat}
              tahun={tahun}
              triwulan={triwulan}
              onBuat={async (formData) => {
                "use server";
                return buatPenilaian({ ok: false }, formData);
              }}
            />
          </>
        }
      />

      <div className="mb-4">
        <FilterDaftar
          cari={cari}
          status={status}
          uptId={uptTerpilih}
          daftarUpt={daftarUpt ?? undefined}
        />
      </div>

      <Kartu>
        {daftar.length === 0 ? (
          <KosongData
            judul="Belum ada penilaian"
            pesan={
              cari || status
                ? "Tidak ada penilaian yang cocok dengan filter. Coba ubah kata kunci atau status."
                : `Belum ada penilaian pada ${triwulan} ${tahun}. Mulai dengan menekan tombol "Buat Penilaian".`
            }
          />
        ) : (
          <div className="scroll-halus overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="px-5 py-3 font-medium">Daerah Irigasi</th>
                  {sesi.isAdmin ? <th className="px-5 py-3 font-medium">UPT</th> : null}
                  <th className="px-5 py-3 font-medium">Kelengkapan</th>
                  <th className="px-5 py-3 text-right font-medium">Nilai IKSI</th>
                  <th className="px-5 py-3 font-medium">Kategori</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Diperbarui</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daftar.map((p) => {
                  const kat = p.total === null ? null : kategoriIksi(p.total);
                  const terisi = p.jmlTerisi ?? 0;
                  const dari = p.jmlIndikator ?? 0;
                  const lengkap = dari > 0 && terisi >= dari;

                  return (
                    <BarisTabel key={p.id} href={`/penilaian/${p.id}`} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <Link href={`/penilaian/${p.id}`} className="block">
                          <span className="block font-medium text-slate-800 group-hover:text-brand-700">
                            {p.diNama}
                          </span>
                          <span className="mt-0.5 block font-mono text-xs text-slate-400">
                            {p.diKode}
                            {p.kecamatan ? ` · ${p.kecamatan}` : ""}
                          </span>
                        </Link>
                      </td>

                      {sesi.isAdmin ? (
                        <td className="px-5 py-3 text-xs text-slate-600">{p.uptNama}</td>
                      ) : null}

                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <BilahProgres
                            nilai={terisi}
                            maks={dari || 1}
                            className="w-20"
                            warnaBilah={lengkap ? "bg-emerald-500" : "bg-brand-600"}
                          />
                          <span className="font-mono text-xs tabular-nums text-slate-500">
                            {terisi}/{dari || "–"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3 text-right font-medium tabular-nums text-slate-800">
                        {p.total === null ? "–" : formatAngka(p.total, 2)}
                      </td>

                      <td className="px-5 py-3">
                        {kat ? (
                          <Lencana nada={nadaKategori(kat)}>
                            {INFO_KATEGORI_IKSI[kat].singkat}
                          </Lencana>
                        ) : (
                          <span className="text-xs text-slate-400">–</span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        <Lencana nada={INFO_STATUS[p.status].nada}>
                          {INFO_STATUS[p.status].label}
                        </Lencana>
                      </td>

                      <td className="px-5 py-3 text-xs text-slate-500">
                        {formatTanggal(p.diperbarui)}
                      </td>

                      <td className="pr-4">
                        <Link
                          href={`/penilaian/${p.id}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                          aria-label={`Buka penilaian ${p.diNama}`}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </BarisTabel>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Kartu>
    </>
  );
}
