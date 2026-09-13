"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { AlertTriangle, ChevronLeft, ChevronRight, Pencil, Plus, Search } from "lucide-react";

import { Input, KosongData, Lencana, Pilihan, Tombol } from "@/components/ui";
import { JENIS_ASET, URUTAN_JENIS } from "@/lib/aset";
import type { BarisAset } from "@/lib/data/aset";
import type { JenisAset } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

import { DialogAset, type PilihanDi } from "./dialog-aset";

export function TabelAset({
  baris,
  total,
  halaman,
  perHalaman,
  filter,
  daftarUpt,
  daftarDi,
  bisaHapus,
  bisaTambah,
}: {
  baris: BarisAset[];
  total: number;
  halaman: number;
  perHalaman: number;
  filter: { jenis: string; upt: string; cari: string; tinjau: boolean };
  daftarUpt?: { id: number; nama: string }[];
  daftarDi: PilihanDi[];
  bisaHapus: boolean;
  bisaTambah: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, mulai] = useTransition();

  const [teks, setTeks] = useState(filter.cari);
  const [diubah, setDiubah] = useState<BarisAset | null>(null);
  const [bukaTambah, setBukaTambah] = useState(false);

  function terapkan(patch: Record<string, string>) {
    const p = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    // Setiap perubahan penyaring mengembalikan ke halaman pertama.
    if (!("hal" in patch)) p.delete("hal");
    mulai(() => router.push(`${pathname}?${p}`));
  }

  useEffect(() => {
    if (teks === filter.cari) return;
    const t = setTimeout(() => terapkan({ cari: teks }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teks]);

  const jmlHalaman = Math.max(1, Math.ceil(total / perHalaman));
  const awal = total === 0 ? 0 : (halaman - 1) * perHalaman + 1;
  const akhir = Math.min(halaman * perHalaman, total);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[15rem] flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            placeholder="Cari nomenklatur, nama aset, nomor, atau D.I.…"
            className="h-9 pl-9 text-xs"
            aria-label="Cari aset"
          />
        </div>

        <Pilihan
          value={filter.jenis}
          onChange={(e) => terapkan({ jenis: e.target.value })}
          className="h-9 w-60 text-xs"
          aria-label="Saring jenis aset"
        >
          <option value="">Semua jenis</option>
          {URUTAN_JENIS.map((j) => (
            <option key={j} value={j}>
              {JENIS_ASET[j].label}
            </option>
          ))}
        </Pilihan>

        {daftarUpt ? (
          <Pilihan
            value={filter.upt}
            onChange={(e) => terapkan({ upt: e.target.value })}
            className="h-9 w-52 text-xs"
            aria-label="Saring UPT"
          >
            <option value="">Semua UPT</option>
            {daftarUpt.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nama}
              </option>
            ))}
          </Pilihan>
        ) : null}

        <Tombol
          varian={filter.tinjau ? "utama" : "garis"}
          ukuran="sm"
          onClick={() => terapkan({ tinjau: filter.tinjau ? "" : "1" })}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Perlu Ditinjau
        </Tombol>

        {bisaTambah ? (
          <Tombol ukuran="sm" onClick={() => setBukaTambah(true)}>
            <Plus className="h-3.5 w-3.5" />
            Tambah
          </Tombol>
        ) : null}
      </div>

      {baris.length === 0 ? (
        <KosongData
          judul="Tidak ada aset"
          pesan="Coba ubah kata kunci atau penyaringnya."
        />
      ) : (
        <>
          <div className="scroll-halus overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[62rem] text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Aset</th>
                  <th className="px-4 py-2.5 font-medium">Jenis</th>
                  <th className="px-4 py-2.5 font-medium">Daerah Irigasi</th>
                  <th className="px-4 py-2.5 font-medium">Lokasi</th>
                  <th className="px-4 py-2.5 font-medium">Nomor Aset</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {baris.map((a) => (
                  <tr
                    key={a.id}
                    className={cn("hover:bg-slate-50/70", a.perlu_tinjau && "bg-amber-50/40")}
                  >
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2">
                        {a.nomenklatur ? (
                          <code className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-brand-700">
                            {a.nomenklatur}
                          </code>
                        ) : null}
                        {a.perlu_tinjau ? (
                          <span title={a.alasan_tinjau ?? "Perlu ditinjau"}>
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block font-medium text-slate-800">{a.nama}</span>
                    </td>

                    <td className="px-4 py-2.5">
                      <Lencana nada="netral">{JENIS_ASET[a.jenis as JenisAset].singkat}</Lencana>
                    </td>

                    <td className="px-4 py-2.5">
                      {a.diNama ? (
                        <>
                          <span className="block text-slate-700">{a.diNama}</span>
                          <span className="mt-0.5 block text-[11px] text-slate-400">
                            {a.uptNama ?? "—"}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-amber-700">
                          {a.nama_di_buku ?? "belum ditautkan"}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      {a.desa ?? "–"}
                      {a.kecamatan ? (
                        <span className="block text-slate-400">{a.kecamatan}</span>
                      ) : null}
                    </td>

                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                      {a.kode ?? <span className="text-amber-600">belum ada</span>}
                    </td>

                    <td className="pr-3">
                      <button
                        type="button"
                        onClick={() => setDiubah(a)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                        aria-label={`Ubah ${a.nomenklatur ?? a.nama}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-500">
              Menampilkan {awal}–{akhir} dari {total.toLocaleString("id-ID")} aset
            </span>
            <div className="flex items-center gap-1.5">
              <Tombol
                varian="garis"
                ukuran="sm"
                disabled={halaman <= 1}
                onClick={() => terapkan({ hal: String(halaman - 1) })}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
              </Tombol>
              <span className="px-2 text-xs text-slate-500">
                {halaman} / {jmlHalaman}
              </span>
              <Tombol
                varian="garis"
                ukuran="sm"
                disabled={halaman >= jmlHalaman}
                onClick={() => terapkan({ hal: String(halaman + 1) })}
              >
                Berikutnya <ChevronRight className="h-3.5 w-3.5" />
              </Tombol>
            </div>
          </div>
        </>
      )}

      {diubah ? (
        <DialogAset
          key={diubah.id}
          aset={diubah}
          buka
          daftarDi={daftarDi}
          bisaHapus={bisaHapus}
          onTutup={() => setDiubah(null)}
        />
      ) : null}

      {bukaTambah ? (
        <DialogAset
          key="baru"
          aset={null}
          buka
          daftarDi={daftarDi}
          bisaHapus={false}
          onTutup={() => setBukaTambah(false)}
        />
      ) : null}
    </>
  );
}
