"use client";

import { AlertTriangle } from "lucide-react";

import { Kartu, KartuIsi, KartuJudul, KartuKepala } from "@/components/ui";
import { cn, formatAngka } from "@/lib/utils";

export interface NilaiAreal {
  bangunan_utama: number;
  saluran_pembawa: number;
  bangunan_saluran_pembawa: number;
  saluran_pembuang: number;
  jalan_inspeksi: number;
  kantor_perumahan_gudang: number;
}

/** Urutan & label mengikuti kolom template "Areal Terdampak dan IKSI". */
const KOLOM: { kunci: keyof NilaiAreal; label: string; kolom: string }[] = [
  { kunci: "bangunan_utama", label: "Bangunan Utama", kolom: "4" },
  { kunci: "saluran_pembawa", label: "Saluran Pembawa", kolom: "5" },
  { kunci: "bangunan_saluran_pembawa", label: "Bangunan pada Saluran Pembawa", kolom: "6" },
  { kunci: "saluran_pembuang", label: "Saluran Pembuang dan Bangunannya", kolom: "7" },
  { kunci: "jalan_inspeksi", label: "Jalan Masuk/Inspeksi", kolom: "8" },
  { kunci: "kantor_perumahan_gudang", label: "Kantor, Perumahan dan Gudang", kolom: "9" },
];

export function PanelAreal({
  nilai,
  luasBaku,
  terkunci,
  onUbah,
}: {
  nilai: NilaiAreal;
  luasBaku: number | null;
  terkunci: boolean;
  onUbah: (v: NilaiAreal) => void;
}) {
  const total = KOLOM.reduce((a, k) => a + (Number(nilai[k.kunci]) || 0), 0);
  // Catatan no. 2 template: total areal terdampak tidak boleh melebihi luas baku.
  const melebihi = luasBaku !== null && total > Number(luasBaku) + 1e-9;

  return (
    <Kartu>
      <KartuKepala>
        <KartuJudul>Areal Terdampak (Ha)</KartuJudul>
        <p className="mt-1 text-xs text-slate-500">
          Luas areal yang terdampak kondisi jaringan irigasi. Mengisi kolom 4–9 pada template
          rekapitulasi, tidak memengaruhi nilai IKSI.
        </p>
      </KartuKepala>
      <KartuIsi>
        <div className="grid gap-3 sm:grid-cols-2">
          {KOLOM.map((k) => (
            <label key={k.kunci} className="block">
              <span className="mb-1 flex items-baseline gap-1.5">
                <span className="font-mono text-[10px] text-slate-400">Kol. {k.kolom}</span>
                <span className="text-xs font-medium text-slate-600">{k.label}</span>
              </span>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  value={nilai[k.kunci] === 0 ? "" : nilai[k.kunci]}
                  placeholder="0"
                  disabled={terkunci}
                  onChange={(e) =>
                    onUbah({ ...nilai, [k.kunci]: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white pr-9 pl-3 text-sm tabular-nums focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:bg-slate-50"
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-slate-400">
                  Ha
                </span>
              </div>
            </label>
          ))}
        </div>

        <div
          className={cn(
            "mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3.5 py-3 text-sm",
            melebihi ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-700",
          )}
        >
          <span className="flex items-center gap-2 font-medium">
            {melebihi ? <AlertTriangle className="h-4 w-4" aria-hidden /> : null}
            Total areal terdampak
          </span>
          <span className="font-mono tabular-nums">
            {formatAngka(total, 3)} Ha
            <span className={melebihi ? "text-rose-500" : "text-slate-400"}>
              {" "}
              / {formatAngka(luasBaku, 3)} Ha luas baku
            </span>
          </span>
        </div>

        {melebihi ? (
          <p className="mt-2 text-xs text-rose-600">
            Total areal terdampak melebihi luas baku D.I. Periksa kembali angkanya — sesuai catatan
            template, total kolom 4–7 tidak boleh melampaui luas daerah irigasi (kolom 3).
          </p>
        ) : null}
      </KartuIsi>
    </Kartu>
  );
}
