"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Search } from "lucide-react";

import { Input, Pilihan } from "@/components/ui";
import { INFO_STATUS } from "@/lib/tampilan";
import type { StatusPenilaian } from "@/lib/supabase/types";

const SEMUA_STATUS = Object.keys(INFO_STATUS) as StatusPenilaian[];

export function FilterDaftar({
  cari,
  status,
  uptId,
  daftarUpt,
}: {
  cari: string;
  /** Dihilangkan bila daftar yang difilter tidak punya konsep status (mis. master data). */
  status?: string;
  uptId: string;
  daftarUpt?: { id: number; nama: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, mulai] = useTransition();
  const [teks, setTeks] = useState(cari);

  function terapkan(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    mulai(() => router.push(`${pathname}?${params}`));
  }

  // Tunda penerapan pencarian supaya tidak menembak navigasi tiap ketikan.
  useEffect(() => {
    if (teks === cari) return;
    const t = setTimeout(() => terapkan({ cari: teks }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teks]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[13rem] flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <Input
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          placeholder="Cari nama atau kode D.I.…"
          className="h-9 pl-9 text-xs"
          aria-label="Cari daerah irigasi"
        />
      </div>

      {daftarUpt ? (
        <Pilihan
          value={uptId}
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

      {status !== undefined ? (
        <Pilihan
          value={status}
          onChange={(e) => terapkan({ status: e.target.value })}
          className="h-9 w-36 text-xs"
          aria-label="Saring status"
        >
          <option value="">Semua status</option>
          {SEMUA_STATUS.map((s) => (
            <option key={s} value={s}>
              {INFO_STATUS[s].label}
            </option>
          ))}
        </Pilihan>
      ) : null}
    </div>
  );
}
