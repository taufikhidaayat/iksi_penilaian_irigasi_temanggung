import { AlertTriangle, Boxes, Link2Off } from "lucide-react";

import { KartuStatistik } from "@/components/dasbor/kartu-statistik";
import { KepalaHalaman } from "@/components/layout/kepala-halaman";
import { TabelAset } from "@/components/aset/tabel-aset";
import { Kartu, KartuIsi, KartuJudul, KartuKepala } from "@/components/ui";
import { JENIS_ASET } from "@/lib/aset";
import { ambilSesi } from "@/lib/auth";
import { ambilDaftarAset, ambilRingkasanAset } from "@/lib/data/aset";
import { createClient } from "@/lib/supabase/server";
import type { JenisAset } from "@/lib/supabase/types";
import { formatAngka } from "@/lib/utils";

const PER_HALAMAN = 50;

function satu(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function HalamanAset({ searchParams }: PageProps<"/aset">) {
  const sesi = await ambilSesi();
  const sp = await searchParams;

  const jenis = satu(sp.jenis);
  const uptParam = satu(sp.upt);
  const cari = satu(sp.cari);
  const tinjau = satu(sp.tinjau) === "1";
  const halaman = Math.max(1, Number(satu(sp.hal)) || 1);

  // Petugas UPT selalu terkunci pada wilayahnya.
  const uptId = sesi.isAdmin ? (uptParam ? Number(uptParam) : null) : sesi.profil.upt_id;

  const supabase = await createClient();

  let qDi = supabase.from("daerah_irigasi").select("id, kode, nama").eq("aktif", true).order("nama");
  if (uptId !== null) qDi = qDi.eq("upt_id", uptId);

  const [hasil, ringkasan, { data: daftarUpt }, { data: daftarDi }] = await Promise.all([
    ambilDaftarAset({
      jenis: (jenis || null) as JenisAset | null,
      uptId,
      cari,
      tinjau,
      halaman,
      perHalaman: PER_HALAMAN,
    }),
    ambilRingkasanAset(uptId),
    sesi.isAdmin
      ? supabase.from("upt").select("id, nama").order("urutan")
      : Promise.resolve({ data: null }),
    qDi.limit(700),
  ]);

  return (
    <>
      <KepalaHalaman
        judul="Aset Irigasi"
        deskripsi={
          sesi.isAdmin
            ? "Register aset jaringan irigasi sesuai Permen PUPR No. 23/PRT/M/2015."
            : `Aset jaringan irigasi wilayah ${sesi.upt?.nama ?? ""}.`
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KartuStatistik
          label="Total Aset"
          nilai={formatAngka(ringkasan.total, 0)}
          keterangan={`${ringkasan.perJenis.length} jenis aset`}
          ikon={Boxes}
        />
        <KartuStatistik
          label="Perlu Ditinjau"
          nilai={formatAngka(ringkasan.perluTinjau, 0)}
          keterangan="Nomor, nomenklatur, atau D.I. belum lengkap"
          ikon={AlertTriangle}
          nada={ringkasan.perluTinjau > 0 ? "kuning" : "hijau"}
        />
        <KartuStatistik
          label="Belum Tertaut D.I."
          nilai={formatAngka(ringkasan.tanpaDi, 0)}
          keterangan="Tidak bisa muncul sebagai konteks penilaian"
          ikon={Link2Off}
          nada={ringkasan.tanpaDi > 0 ? "kuning" : "hijau"}
        />
      </div>

      <Kartu className="mb-4">
        <KartuKepala>
          <KartuJudul>Rincian per Jenis</KartuJudul>
        </KartuKepala>
        <KartuIsi>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {ringkasan.perJenis.map((r) => (
              <div key={r.jenis} className="rounded-lg bg-slate-50 px-3 py-2.5">
                <p className="text-lg font-semibold tabular-nums text-slate-900">
                  {formatAngka(r.jumlah, 0)}
                </p>
                <p className="mt-0.5 text-[11px] leading-tight text-slate-500">
                  {JENIS_ASET[r.jenis].label}
                </p>
              </div>
            ))}
          </div>
        </KartuIsi>
      </Kartu>

      <Kartu>
        <KartuIsi>
          <TabelAset
            baris={hasil.baris}
            total={hasil.total}
            halaman={hasil.halaman}
            perHalaman={hasil.perHalaman}
            filter={{ jenis, upt: uptParam, cari, tinjau }}
            daftarUpt={daftarUpt ?? undefined}
            daftarDi={daftarDi ?? []}
            bisaHapus={sesi.isAdmin}
            bisaTambah
          />
        </KartuIsi>
      </Kartu>
    </>
  );
}
