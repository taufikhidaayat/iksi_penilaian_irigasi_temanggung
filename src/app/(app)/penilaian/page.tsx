import { cookies } from "next/headers";

import { FilterPeriode } from "@/components/layout/filter-periode";
import { KepalaHalaman } from "@/components/layout/kepala-halaman";
import { PapanPenilaian } from "@/components/penilaian/papan-penilaian";
import { ambilSesi } from "@/lib/auth";
import { ambilPapanPenilaian } from "@/lib/data/penilaian";
import { bacaPeriode } from "@/lib/periode";
import { createClient } from "@/lib/supabase/server";
import { KUKI_TAMPILAN, bacaTampilan } from "@/lib/tampilan";

function satu(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function HalamanDaftarPenilaian({ searchParams }: PageProps<"/penilaian">) {
  const sesi = await ambilSesi();
  const sp = await searchParams;
  const { tahun, triwulan } = bacaPeriode(sp);

  const uptTerpilih = satu(sp.upt);

  // UPT non-admin selalu terkunci ke UPT-nya sendiri.
  const uptId = sesi.isAdmin
    ? uptTerpilih
      ? Number(uptTerpilih)
      : null
    : sesi.profil.upt_id;

  const supabase = await createClient();
  const [daftar, { data: daftarUpt }, kuki] = await Promise.all([
    ambilPapanPenilaian({ tahun, triwulan, uptId }),
    sesi.isAdmin
      ? supabase.from("upt").select("id, nama").order("urutan")
      : Promise.resolve({ data: null }),
    cookies(),
  ]);

  return (
    <>
      <KepalaHalaman
        judul="Penilaian"
        deskripsi={`${triwulan} ${tahun}`}
        aksi={<FilterPeriode tahun={tahun} triwulan={triwulan} />}
      />

      <PapanPenilaian
        daftar={daftar}
        tahun={tahun}
        triwulan={triwulan}
        isAdmin={sesi.isAdmin}
        uptId={uptTerpilih}
        daftarUpt={daftarUpt ?? undefined}
        tampilanAwal={bacaTampilan(kuki.get(KUKI_TAMPILAN)?.value)}
      />
    </>
  );
}
