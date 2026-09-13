import { KepalaHalaman } from "@/components/layout/kepala-halaman";
import { FilterDaftar } from "@/components/penilaian/filter-daftar";
import { Kartu, KartuIsi, KosongData, Lencana } from "@/components/ui";
import { ambilSesi } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatAngka } from "@/lib/utils";

function satu(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function HalamanDaerahIrigasi({
  searchParams,
}: PageProps<"/daerah-irigasi">) {
  const sesi = await ambilSesi();
  const sp = await searchParams;
  const cari = satu(sp.cari).trim();
  const uptParam = satu(sp.upt);

  const uptId = sesi.isAdmin ? (uptParam ? Number(uptParam) : null) : sesi.profil.upt_id;

  const supabase = await createClient();

  let q = supabase
    .from("daerah_irigasi")
    .select("id, kode, nama, kecamatan, desa, luas_baku, luas_potensial, luas_fungsional, upt_id")
    .eq("aktif", true)
    .order("nama")
    .limit(500);
  if (uptId !== null) q = q.eq("upt_id", uptId);
  if (cari) q = q.or(`nama.ilike.%${cari}%,kode.ilike.%${cari}%`);

  const [{ data: daftar }, { data: daftarUpt }] = await Promise.all([
    q,
    supabase.from("upt").select("id, nama").order("urutan"),
  ]);

  const uptMap = new Map((daftarUpt ?? []).map((u) => [u.id, u.nama]));
  const baris = daftar ?? [];

  return (
    <>
      <KepalaHalaman
        judul="Daerah Irigasi"
        deskripsi={
          sesi.isAdmin
            ? "Master data daerah irigasi kewenangan Kabupaten Temanggung (Permen PUPR 14/2015)."
            : `Daerah irigasi wilayah ${sesi.upt?.nama ?? ""}.`
        }
      />

      <div className="mb-4">
        <FilterDaftar
          cari={cari}
          uptId={uptParam}
          daftarUpt={sesi.isAdmin ? (daftarUpt ?? undefined) : undefined}
        />
      </div>

      <Kartu>
        {baris.length === 0 ? (
          <KosongData
            judul="Tidak ada daerah irigasi"
            pesan="Coba ubah kata kunci pencarian atau filter UPT."
          />
        ) : (
          <>
            <KartuIsi className="border-b border-slate-100 py-3">
              <p className="text-xs text-slate-500">
                Menampilkan <strong className="text-slate-700">{baris.length}</strong> daerah
                irigasi
                {baris.length >= 500 ? " (dibatasi 500 baris — persempit pencarian)" : ""}.
              </p>
            </KartuIsi>
            <div className="scroll-halus overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="px-5 py-3 font-medium">Kode</th>
                    <th className="px-5 py-3 font-medium">Nama Daerah Irigasi</th>
                    <th className="px-5 py-3 font-medium">Kecamatan</th>
                    <th className="px-5 py-3 font-medium">Desa/Kelurahan</th>
                    <th className="px-5 py-3 text-right font-medium">Luas Baku</th>
                    <th className="px-5 py-3 text-right font-medium">Potensial</th>
                    <th className="px-5 py-3 text-right font-medium">Fungsional</th>
                    {sesi.isAdmin ? <th className="px-5 py-3 font-medium">UPT</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {baris.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{d.kode}</td>
                      <td className="px-5 py-2.5 font-medium text-slate-800">{d.nama}</td>
                      <td className="px-5 py-2.5 text-slate-600">{d.kecamatan ?? "–"}</td>
                      <td className="px-5 py-2.5 text-slate-600">{d.desa ?? "–"}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-slate-700">
                        {formatAngka(d.luas_baku, 2)}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">
                        {formatAngka(d.luas_potensial, 2)}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">
                        {formatAngka(d.luas_fungsional, 2)}
                      </td>
                      {sesi.isAdmin ? (
                        <td className="px-5 py-2.5">
                          <Lencana nada="biru">
                            {d.upt_id ? (uptMap.get(d.upt_id) ?? "–") : "–"}
                          </Lencana>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Kartu>
    </>
  );
}
