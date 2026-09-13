"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Pilihan } from "@/components/ui";
import { TRIWULAN, daftarTahun } from "@/lib/periode";
import type { PeriodeTriwulan } from "@/lib/supabase/types";

export function FilterPeriode({
  tahun,
  triwulan,
}: {
  tahun: number;
  triwulan: PeriodeTriwulan;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [menunggu, mulai] = useTransition();

  function ubah(kunci: "tahun" | "triwulan", nilai: string) {
    const params = new URLSearchParams(searchParams);
    params.set(kunci, nilai);
    mulai(() => router.push(`${pathname}?${params}`));
  }

  return (
    <div className="flex items-center gap-2" data-menunggu={menunggu || undefined}>
      <Pilihan
        aria-label="Tahun"
        value={String(tahun)}
        onChange={(e) => ubah("tahun", e.target.value)}
        className="h-9 w-28 text-xs"
      >
        {daftarTahun().map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Pilihan>
      <Pilihan
        aria-label="Triwulan"
        value={triwulan}
        onChange={(e) => ubah("triwulan", e.target.value)}
        className="h-9 w-36 text-xs"
      >
        {TRIWULAN.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Pilihan>
    </div>
  );
}
