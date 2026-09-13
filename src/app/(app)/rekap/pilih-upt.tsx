"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Pilihan } from "@/components/ui";

export function PilihUpt({
  daftar,
  terpilih,
}: {
  daftar: { id: number; nama: string }[];
  terpilih: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, mulai] = useTransition();

  return (
    <Pilihan
      value={terpilih}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams);
        if (e.target.value) params.set("upt", e.target.value);
        else params.delete("upt");
        mulai(() => router.push(`${pathname}?${params}`));
      }}
      className="h-9 w-52 text-xs"
      aria-label="Saring UPT"
    >
      <option value="">Semua UPT</option>
      {daftar.map((u) => (
        <option key={u.id} value={u.id}>
          {u.nama}
        </option>
      ))}
    </Pilihan>
  );
}
