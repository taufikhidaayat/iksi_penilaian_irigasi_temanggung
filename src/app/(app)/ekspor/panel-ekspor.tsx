"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { AlertTriangle, Info } from "lucide-react";

import {
  Centang,
  IkonExcel,
  Input,
  Kartu,
  KartuIsi,
  KartuJudul,
  KartuKepala,
  Label,
  Tombol,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { PeriodeTriwulan } from "@/lib/supabase/types";

export interface PanelEksporProps {
  tahun: number;
  triwulan: PeriodeTriwulan;
  uptId: number | null;
  labelUpt: string | null;
  jumlahBaris: number;
  jumlahDinilai: number;
  /** D.I. yang sudah punya nilai tapi belum berstatus disetujui. */
  jumlahBelumDisetujui: number;
  /** Dikendalikan lewat URL (`?final=1`) supaya pratinjau ikut berubah, bukan cuma berkas unduhan. */
  hanyaFinal: boolean;
}

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function PanelEkspor({
  tahun,
  triwulan,
  uptId,
  labelUpt,
  jumlahBaris,
  jumlahDinilai,
  jumlahBelumDisetujui,
  hanyaFinal,
}: PanelEksporProps) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, mulai] = useTransition();
  const sekarang = new Date();
  const [tempat, setTempat] = useState(
    `Temanggung, ${BULAN[sekarang.getMonth()]} ${sekarang.getFullYear()}`,
  );
  const [jabatan, setJabatan] = useState(
    "KEPALA DINAS PEKERJAAN UMUM|DAN PENATAAN RUANG|KABUPATEN TEMANGGUNG",
  );
  const [nama, setNama] = useState("");
  const [nip, setNip] = useState("NIP.");

  // Lewat URL, bukan state lokal, supaya panel Pratinjau di sebelah (dirender
  // server) ikut menghitung ulang dan benar-benar menunjukkan baris mana yang
  // dikosongkan, bukan cuma berkas Excel yang berubah tanpa terlihat di sini.
  function gantiHanyaFinal(v: boolean) {
    const p = new URLSearchParams(searchParams);
    if (v) p.set("final", "1");
    else p.delete("final");
    mulai(() => router.push(`${pathname}?${p}`));
  }

  const params = new URLSearchParams({
    tahun: String(tahun),
    triwulan,
    ttdTempat: tempat,
    ttdJabatan: jabatan,
    ttdNama: nama,
    ttdNip: nip,
  });
  if (uptId !== null) params.set("upt", String(uptId));
  if (hanyaFinal) params.set("final", "1");

  return (
    <Kartu className="xl:sticky xl:top-6 xl:self-start">
      <KartuKepala>
        <KartuJudul>Pengaturan Ekspor</KartuJudul>
      </KartuKepala>
      <KartuIsi className="space-y-4">
        <dl className="space-y-2 rounded-lg bg-slate-50 p-3 text-xs">
          {[
            ["Periode", `${triwulan} ${tahun}`],
            ["Cakupan", labelUpt ?? "Seluruh UPT (kabupaten)"],
            ["Baris data", `${jumlahBaris} D.I.`],
            ["Sudah dinilai", `${jumlahDinilai} D.I.`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-right font-medium text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>

        <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
          <Centang
            checked={hanyaFinal}
            onChange={(e) => gantiHanyaFinal(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-xs font-medium text-slate-700">
              Hanya penilaian yang sudah disetujui
            </span>
            <span className="mt-0.5 block text-[11px] text-slate-500">
              Draft dan yang masih diajukan akan dikosongkan. Gunakan untuk laporan resmi.
            </span>
            {jumlahBelumDisetujui > 0 ? (
              <span className="mt-1.5 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
                <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden />
                {hanyaFinal
                  ? `${jumlahBelumDisetujui} D.I. dikosongkan di pratinjau & berkas karena belum disetujui.`
                  : `${jumlahBelumDisetujui} D.I. sudah dinilai tapi belum disetujui, akan ikut kosong kalau opsi ini dicentang.`}
              </span>
            ) : null}
          </span>
        </label>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-700">Blok Tanda Tangan</p>

          <div>
            <Label htmlFor="ttd-tempat">Tempat &amp; Tanggal</Label>
            <Input
              id="ttd-tempat"
              value={tempat}
              onChange={(e) => setTempat(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div>
            <Label htmlFor="ttd-jabatan">Jabatan (pisahkan baris dengan |)</Label>
            <Input
              id="ttd-jabatan"
              value={jabatan}
              onChange={(e) => setJabatan(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div>
            <Label htmlFor="ttd-nama">Nama Penanda Tangan</Label>
            <Input
              id="ttd-nama"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama lengkap dan gelar"
              className="h-9 text-xs"
            />
          </div>

          <div>
            <Label htmlFor="ttd-nip">NIP</Label>
            <Input
              id="ttd-nip"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>

        <a
          href={`/api/ekspor?${params}`}
          download
          className="block"
          onClick={() =>
            toast.info(
              "Menyiapkan berkas Excel",
              `${jumlahBaris} baris D.I., unduhan akan dimulai sebentar lagi.`,
            )
          }
        >
          <Tombol varian="excel" ukuran="lg" className="w-full">
            <IkonExcel />
            Unduh Excel
          </Tombol>
        </a>

        <p className="flex items-start gap-2 text-[11px] text-slate-500">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Berkas mengikuti template <IkonExcel className="inline h-3 w-3 text-excel-600" />{" "}
            <em>&ldquo;9 - Areal Terdampak dan IKSI&rdquo;</em>: merge header, penomoran kolom,
            format akuntansi, baris Total (luas dijumlah, skor dirata-rata), catatan kriteria, dan
            blok tanda tangan.
          </span>
        </p>
      </KartuIsi>
    </Kartu>
  );
}
