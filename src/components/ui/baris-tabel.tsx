"use client";

import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Baris tabel yang bisa diklik di mana saja untuk membuka tautan tujuannya,
 * bukan cuma lewat tautan teks atau ikon panah di dalam baris. Tautan asli itu
 * tetap dipertahankan di dalam (untuk navigasi keyboard, klik-kanan buka tab
 * baru, dan pembaca layar); `onClick` di sini cuma kemudahan tambahan untuk
 * mouse, jadi tidak perlu tabIndex/peran ARIA sendiri di elemen <tr>-nya.
 */
export function BarisTabel({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <tr onClick={() => router.push(href)} className={cn("group cursor-pointer", className)}>
      {children}
    </tr>
  );
}
