"use client";

import { useMemo, useState } from "react";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Input, Lencana, Pilihan, Tombol } from "@/components/ui";
import type { BarisRekap } from "@/lib/data/rekap";
import { INFO_KATEGORI_IKSI } from "@/lib/iksi/scoring";
import { BOBOT_PRASARANA_FISIK, nadaKategori, setaraPersen } from "@/lib/tampilan";
import { cn, formatAngka } from "@/lib/utils";

const PER_HALAMAN = 50;

/** Angka bergaya template: kosong ditampilkan sebagai "-". */
function sel(v: number | null | undefined, desimal = 2): string {
  return v === null || v === undefined ? "-" : formatAngka(v, desimal);
}

export function TabelRekap({
  baris,
  total,
  tampilUpt = false,
  ringkas = false,
}: {
  baris: BarisRekap[];
  total: {
    luasBaku: number;
    areal: BarisRekap["areal"];
    skor: BarisRekap["skor"];
    total: number;
  };
  tampilUpt?: boolean;
  /** Mode pratinjau: tanpa pencarian, hanya sebagian baris. */
  ringkas?: boolean;
}) {
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState<"semua" | "dinilai" | "belum">("semua");
  const [halaman, setHalaman] = useState(0);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return baris.filter((b) => {
      if (saring === "dinilai" && b.total === null) return false;
      if (saring === "belum" && b.total !== null) return false;
      if (!q) return true;
      return b.nama.toLowerCase().includes(q) || b.kode.includes(q);
    });
  }, [baris, cari, saring]);

  const tampil = ringkas ? tersaring.slice(0, 25) : tersaring.slice(halaman * PER_HALAMAN, (halaman + 1) * PER_HALAMAN);
  const jmlHalaman = Math.max(1, Math.ceil(tersaring.length / PER_HALAMAN));

  return (
    <div>
      {!ringkas ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[13rem] flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              value={cari}
              onChange={(e) => {
                setCari(e.target.value);
                setHalaman(0);
              }}
              placeholder="Cari nama atau kode D.I.…"
              className="h-9 pl-9 text-xs"
              aria-label="Cari daerah irigasi"
            />
          </div>
          <Pilihan
            value={saring}
            onChange={(e) => {
              setSaring(e.target.value as typeof saring);
              setHalaman(0);
            }}
            className="h-9 w-40 text-xs"
            aria-label="Saring status penilaian"
          >
            <option value="semua">Semua D.I.</option>
            <option value="dinilai">Sudah dinilai</option>
            <option value="belum">Belum dinilai</option>
          </Pilihan>
          <span className="text-xs text-slate-500">
            {tersaring.length} dari {baris.length} D.I.
          </span>
        </div>
      ) : null}

      <div className="scroll-halus overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[1280px] border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              <th rowSpan={2} className="border border-slate-200 px-2 py-2 font-semibold text-slate-600">
                No.
              </th>
              <th
                rowSpan={2}
                className="min-w-[13rem] border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600"
              >
                Nomenklatur / Nama Daerah Irigasi
              </th>
              {tampilUpt ? (
                <th rowSpan={2} className="border border-slate-200 px-2 py-2 font-semibold text-slate-600">
                  UPT
                </th>
              ) : null}
              <th rowSpan={2} className="border border-slate-200 px-2 py-2 font-semibold text-slate-600">
                Luas
                <span className="block font-normal text-slate-400">(Ha)</span>
              </th>
              <th colSpan={8} className="border border-slate-200 bg-brand-50/60 px-2 py-1.5 font-semibold text-brand-800">
                Prasarana Fisik
              </th>
              <th colSpan={6} className="border border-slate-200 bg-emerald-50/60 px-2 py-1.5 font-semibold text-emerald-800">
                Indeks Kondisi Sistem Irigasi (%)
              </th>
              <th rowSpan={2} className="border border-slate-200 px-2 py-2 font-semibold text-slate-600">
                Kategori
              </th>
            </tr>
            <tr className="text-[10px] text-slate-500">
              {[
                "Bangunan Utama",
                "Saluran Pembawa",
                "Bangunan pd Sal. Pembawa",
                "Saluran Pembuang",
                "Jalan Inspeksi",
                "Kantor/Perumahan",
              ].map((h) => (
                <th key={h} className="border border-slate-200 px-1.5 py-1.5 font-medium">
                  {h}
                  <span className="block font-normal text-slate-400">Ha</span>
                </th>
              ))}
              {/* Kolom informasi: Prasarana Fisik pada skalanya sendiri.
                  Tidak ikut dijumlahkan ke mana pun, hanya supaya kondisi
                  bangunan bisa dibaca tanpa membagi 45 di kepala sendiri. */}
              <th className="border border-slate-200 bg-brand-50/20 px-1.5 py-1.5 font-semibold">
                Kondisi
                <span className="block font-normal text-slate-400">skala 100</span>
              </th>
              <th className="border border-slate-200 bg-brand-50/40 px-1.5 py-1.5 font-semibold">
                Total
                <span className="block font-normal text-slate-400">maks 45</span>
              </th>
              {[
                ["Produktivitas", 15],
                ["Sarana Penunjang", 10],
                ["Organisasi", 15],
                ["Dokumentasi", 5],
                ["P3A/GP3A", 10],
              ].map(([h, m]) => (
                <th key={h as string} className="border border-slate-200 px-1.5 py-1.5 font-medium">
                  {h}
                  <span className="block font-normal text-slate-400">maks {m}</span>
                </th>
              ))}
              <th className="border border-slate-200 bg-emerald-50/40 px-1.5 py-1.5 font-semibold">
                Jumlah
                <span className="block font-normal text-slate-400">maks 100</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {tampil.map((b) => (
              <tr
                key={b.diId}
                className={cn("hover:bg-brand-50/40", b.total === null && "text-slate-400")}
              >
                <td className="border border-slate-200 px-2 py-1.5 text-center tabular-nums">
                  {b.no}
                </td>
                <td className="border border-slate-200 px-3 py-1.5">
                  <span className="font-medium text-slate-800">{b.nama}</span>
                  <span className="ml-1.5 font-mono text-[10px] text-slate-400">{b.kode}</span>
                </td>
                {tampilUpt ? (
                  <td className="border border-slate-200 px-2 py-1.5 text-[10px] whitespace-nowrap">
                    {b.uptNama.replace("Regional ", "R")}
                  </td>
                ) : null}
                <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">
                  {sel(b.luasBaku)}
                </td>

                {[
                  b.areal.bangunanUtama,
                  b.areal.saluranPembawa,
                  b.areal.bangunanSaluranPembawa,
                  b.areal.saluranPembuang,
                  b.areal.jalanInspeksi,
                  b.areal.kantorPerumahanGudang,
                ].map((v, i) => (
                  <td key={i} className="border border-slate-200 px-1.5 py-1.5 text-right tabular-nums">
                    {sel(v)}
                  </td>
                ))}

                <td className="border border-slate-200 bg-brand-50/15 px-1.5 py-1.5 text-right tabular-nums text-slate-500">
                  {sel(setaraPersen(b.skor.prasaranaFisik, BOBOT_PRASARANA_FISIK))}
                </td>
                <td className="border border-slate-200 bg-brand-50/30 px-1.5 py-1.5 text-right font-medium tabular-nums">
                  {sel(b.skor.prasaranaFisik)}
                </td>
                {[
                  b.skor.produktivitas,
                  b.skor.saranaPenunjang,
                  b.skor.organisasi,
                  b.skor.dokumentasi,
                  b.skor.p3a,
                ].map((v, i) => (
                  <td key={i} className="border border-slate-200 px-1.5 py-1.5 text-right tabular-nums">
                    {sel(v)}
                  </td>
                ))}
                <td className="border border-slate-200 bg-emerald-50/30 px-1.5 py-1.5 text-right font-semibold tabular-nums">
                  {sel(b.total)}
                </td>

                <td className="border border-slate-200 px-2 py-1.5 text-center">
                  {b.kategori ? (
                    <Lencana nada={nadaKategori(b.kategori)}>
                      {INFO_KATEGORI_IKSI[b.kategori].singkat}
                    </Lencana>
                  ) : (
                    <span className="text-slate-300">–</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot className="sticky bottom-0 bg-slate-100 font-semibold text-slate-800">
            <tr>
              <td
                colSpan={tampilUpt ? 3 : 2}
                className="border border-slate-300 px-3 py-2 text-center"
              >
                Total
              </td>
              <td className="border border-slate-300 px-2 py-2 text-right tabular-nums">
                {sel(total.luasBaku)}
              </td>
              {[
                total.areal.bangunanUtama,
                total.areal.saluranPembawa,
                total.areal.bangunanSaluranPembawa,
                total.areal.saluranPembuang,
                total.areal.jalanInspeksi,
                total.areal.kantorPerumahanGudang,
              ].map((v, i) => (
                <td key={i} className="border border-slate-300 px-1.5 py-2 text-right tabular-nums">
                  {sel(v)}
                </td>
              ))}
              <td className="border border-slate-300 px-1.5 py-2 text-right tabular-nums text-slate-500">
                {sel(setaraPersen(total.skor.prasaranaFisik, BOBOT_PRASARANA_FISIK))}
              </td>
              <td className="border border-slate-300 px-1.5 py-2 text-right tabular-nums">
                {sel(total.skor.prasaranaFisik)}
              </td>
              {[
                total.skor.produktivitas,
                total.skor.saranaPenunjang,
                total.skor.organisasi,
                total.skor.dokumentasi,
                total.skor.p3a,
              ].map((v, i) => (
                <td key={i} className="border border-slate-300 px-1.5 py-2 text-right tabular-nums">
                  {sel(v)}
                </td>
              ))}
              <td className="border border-slate-300 px-1.5 py-2 text-right tabular-nums">
                {sel(total.total)}
              </td>
              <td className="border border-slate-300" />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        Baris <strong>Total</strong> mengikuti template: kolom luas &amp; areal dijumlahkan,
        kolom nilai komponen <strong>dirata-ratakan</strong> atas D.I. yang sudah dinilai.
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        Kolom <strong>Kondisi (skala 100)</strong> adalah nilai Prasarana Fisik pada skalanya
        sendiri, yaitu Total dibagi {BOBOT_PRASARANA_FISIK} lalu dikali 100. Gunanya membaca
        kondisi bangunan tanpa menghitung sendiri. Kolom ini <strong>tidak ikut dijumlahkan</strong>{" "}
        ke nilai IKSI.
      </p>

      {ringkas ? (
        tersaring.length > 25 ? (
          <p className="mt-1 text-xs text-slate-500">
            Menampilkan 25 dari {tersaring.length} baris. Seluruh baris akan ikut terekspor.
          </p>
        ) : null
      ) : jmlHalaman > 1 ? (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Halaman {halaman + 1} dari {jmlHalaman}
          </span>
          <div className="flex gap-1.5">
            <Tombol
              varian="garis"
              ukuran="sm"
              onClick={() => setHalaman((h) => Math.max(0, h - 1))}
              disabled={halaman === 0}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
            </Tombol>
            <Tombol
              varian="garis"
              ukuran="sm"
              onClick={() => setHalaman((h) => Math.min(jmlHalaman - 1, h + 1))}
              disabled={halaman >= jmlHalaman - 1}
            >
              Berikutnya <ChevronRight className="h-3.5 w-3.5" />
            </Tombol>
          </div>
        </div>
      ) : null}
    </div>
  );
}
