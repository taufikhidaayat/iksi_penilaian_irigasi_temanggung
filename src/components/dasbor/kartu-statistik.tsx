import type { LucideIcon } from "lucide-react";

import { Kartu } from "@/components/ui";
import { cn } from "@/lib/utils";

export function KartuStatistik({
  label,
  nilai,
  satuan,
  keterangan,
  ikon: Ikon,
  nada = "biru",
}: {
  label: string;
  nilai: string;
  satuan?: string;
  keterangan?: string;
  ikon: LucideIcon;
  nada?: "biru" | "hijau" | "kuning" | "merah";
}) {
  const nadaIkon = {
    biru: "bg-brand-50 text-brand-600",
    hijau: "bg-emerald-50 text-emerald-600",
    kuning: "bg-amber-50 text-amber-600",
    merah: "bg-rose-50 text-rose-600",
  }[nada];

  return (
    <Kartu className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-semibold tracking-tight text-slate-900">{nilai}</span>
            {satuan ? <span className="text-sm font-medium text-slate-400">{satuan}</span> : null}
          </p>
          {keterangan ? <p className="mt-1.5 text-xs text-slate-500">{keterangan}</p> : null}
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", nadaIkon)}>
          <Ikon className="h-4.5 w-4.5" aria-hidden />
        </div>
      </div>
    </Kartu>
  );
}
