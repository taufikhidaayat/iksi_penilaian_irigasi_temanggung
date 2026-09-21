import { Droplets, GitBranch, Info, Landmark, Milestone, Mountain, Route, Waves } from "lucide-react";

import { KartuJenis, type IsiKartuJenis } from "@/components/aset-draf/kartu-jenis";
import { KepalaHalaman } from "@/components/layout/kepala-halaman";
import { Kartu, KosongData } from "@/components/ui";
import { JENIS_DRAF } from "@/lib/aset-draf";
import { ambilSesiAdmin } from "@/lib/auth";
import { ambilBerkasDraf, ambilRingkasanDraf } from "@/lib/data/aset-draf";
import type { JenisAset } from "@/lib/supabase/types";

/** Ikon per jenis; dipilih yang bentuknya mengingatkan pada bangunannya. */
const IKON: Partial<Record<JenisAset, typeof Landmark>> = {
  bendung_baru: Landmark,
  saluran: Waves,
  sadap: GitBranch,
  saluran_pelimpah: Droplets,
  terjunan: Mountain,
  talang: Milestone,
  gorong_gorong: Route,
  tanah_saluran: Route,
};

const TANAH: JenisAset[] = ["tanah_saluran"];

export default async function HalamanAsetDraf() {
  await ambilSesiAdmin();

  const [berkas, ringkasan] = await Promise.all([ambilBerkasDraf(), ambilRingkasanDraf()]);
  const peta = new Map(berkas.map((b) => [b.jenis, b]));

  const kartu: IsiKartuJenis[] = JENIS_DRAF.map((jenis) => {
    const b = peta.get(jenis);
    const r = ringkasan.get(jenis);
    return {
      jenis,
      // `jumlah_baris` di metadata adalah angka yang dicatat saat impor.
      // Ringkasan dihitung dari isi tabel, jadi itu yang dipakai; keduanya
      // hanya bisa berselisih kalau ada yang menyunting tabel di luar skrip.
      jumlahAset: r?.jumlahAset ?? b?.jumlah_baris ?? 0,
      jumlahBaris: r?.jumlahBaris ?? b?.jumlah_baris ?? 0,
      jumlahDi: r?.jumlahDi ?? 0,
      jumlahKolom: b?.kolom.length ?? 0,
      namaBerkas: b?.nama_berkas ?? "belum diimpor",
      ikon: IKON[jenis] ?? Landmark,
      tanah: TANAH.includes(jenis),
    };
  });

  const total = kartu.reduce((n, k) => n + k.jumlahAset, 0);
  const adaData = total > 0;

  return (
    <>
      <KepalaHalaman
        judul="Data Aset Draf IKSI"
        deskripsi="Hasil pendataan lapangan berbasis GIS. Pilih satu jenis untuk melihat isinya dan mengunduh Excel."
      />

      {adaData ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {kartu.map((k) => (
              <KartuJenis key={k.jenis} isi={k} />
            ))}
          </div>

          <Kartu className="mt-6 border-brand-100 bg-brand-50/50 p-4 dark:border-brand-900/40 dark:bg-brand-950/20">
            <p className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
              <span>
                Draf ini <strong>belum terverifikasi</strong> dan sengaja tidak bertahun, jadi
                dipakai sebagai bahan pembanding terhadap menu Aset Irigasi, bukan sumber resmi.
                Seluruhnya {total.toLocaleString("id-ID")} aset. Nomor asetnya sudah memakai
                kodefikasi golongan dan UPT yang sama dengan menu Aset Irigasi.
              </span>
            </p>
          </Kartu>
        </>
      ) : (
        <Kartu>
          <KosongData
            judul="Data draf belum diimpor"
            pesan="Jalankan `npm run impor-aset-draf` di server untuk membaca berkas di data/aset-draf/."
          />
        </Kartu>
      )}
    </>
  );
}
