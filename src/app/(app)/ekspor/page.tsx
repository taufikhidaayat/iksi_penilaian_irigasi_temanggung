import { FilterPeriode } from "@/components/layout/filter-periode";
import { KepalaHalaman } from "@/components/layout/kepala-halaman";
import { TabelRekap } from "@/components/rekap/tabel-rekap";
import { Kartu, KartuIsi, KartuJudul, KartuKepala } from "@/components/ui";
import { ambilSesi } from "@/lib/auth";
import { ambilRekap } from "@/lib/data/rekap";
import { bacaPeriode } from "@/lib/periode";
import { createClient } from "@/lib/supabase/server";

import { PilihUpt } from "../rekap/pilih-upt";
import { PanelEkspor } from "./panel-ekspor";

export default async function HalamanEkspor({ searchParams }: PageProps<"/ekspor">) {
  const sesi = await ambilSesi();
  const sp = await searchParams;
  const { tahun, triwulan } = bacaPeriode(sp);

  const uptParam = (Array.isArray(sp.upt) ? sp.upt[0] : sp.upt) ?? "";
  const uptId = sesi.isAdmin ? (uptParam ? Number(uptParam) : null) : sesi.profil.upt_id;
  const finalParam = (Array.isArray(sp.final) ? sp.final[0] : sp.final) ?? "";
  const hanyaFinal = finalParam === "1";

  const supabase = await createClient();
  const [rekapPenuh, { data: daftarUpt }] = await Promise.all([
    ambilRekap({ tahun, triwulan, uptId }),
    sesi.isAdmin
      ? supabase.from("upt").select("id, nama").order("urutan")
      : Promise.resolve({ data: null }),
  ]);

  // Pratinjau harus mencerminkan berkas yang sungguhan akan terunduh. Diambil
  // ulang dengan filter yang sama supaya baris yang dikosongkan oleh opsi
  // "hanya disetujui" kelihatan di sini juga, bukan cuma muncul di Excel.
  const rekap = hanyaFinal
    ? await ambilRekap({ tahun, triwulan, uptId, hanyaDisetujui: true })
    : rekapPenuh;

  const jumlahBelumDisetujui = rekapPenuh.baris.filter(
    (b) => b.total !== null && b.status !== "disetujui",
  ).length;

  const labelUpt = sesi.isAdmin
    ? (daftarUpt?.find((u) => u.id === uptId)?.nama ?? null)
    : (sesi.upt?.nama ?? null);

  return (
    <>
      <KepalaHalaman
        judul="Ekspor Excel"
        deskripsi="Tinjau data terlebih dahulu, lalu unduh dalam format template resmi."
        aksi={
          <>
            {sesi.isAdmin && daftarUpt ? <PilihUpt daftar={daftarUpt} terpilih={uptParam} /> : null}
            <FilterPeriode tahun={tahun} triwulan={triwulan} />
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <Kartu className="min-w-0">
          <KartuKepala>
            <KartuJudul>Pratinjau</KartuJudul>
            <p className="mt-1 text-xs text-slate-500">
              Tampilan ini mencerminkan isi berkas yang akan diunduh.
            </p>
          </KartuKepala>
          <KartuIsi>
            <TabelRekap
              baris={rekap.baris}
              total={rekap.total}
              tampilUpt={sesi.isAdmin && uptId === null}
              ringkas
            />
          </KartuIsi>
        </Kartu>

        <PanelEkspor
          tahun={tahun}
          triwulan={triwulan}
          uptId={uptId}
          labelUpt={labelUpt}
          jumlahBaris={rekapPenuh.baris.length}
          jumlahDinilai={rekapPenuh.jumlahDinilai}
          jumlahBelumDisetujui={jumlahBelumDisetujui}
          hanyaFinal={hanyaFinal}
        />
      </div>
    </>
  );
}
