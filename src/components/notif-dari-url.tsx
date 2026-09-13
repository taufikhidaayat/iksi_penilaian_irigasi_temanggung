"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { useToast } from "@/components/ui/toast";
import { PARAM_NOTIF, PESAN_NOTIF, notifValid } from "@/lib/notif";

/**
 * Menampilkan notifikasi yang dititipkan lewat query string oleh Server Action
 * yang berakhir dengan redirect (mis. masuk dan keluar), lalu membersihkan
 * parameternya dari URL supaya tidak muncul lagi saat halaman dimuat ulang.
 */
export function NotifDariUrl() {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const kunci = searchParams.get(PARAM_NOTIF);

  // React 18+ memasang efek dua kali di mode pengembangan; tanpa penanda ini
  // notifikasi yang sama akan muncul dobel.
  const sudah = useRef<string | null>(null);

  useEffect(() => {
    if (!notifValid(kunci) || sudah.current === kunci) return;
    sudah.current = kunci;

    const { jenis, judul, pesan } = PESAN_NOTIF[kunci];
    toast.tampilkan({ jenis, judul, pesan });

    const sisa = new URLSearchParams(searchParams);
    sisa.delete(PARAM_NOTIF);
    const kueri = sisa.toString();
    router.replace(kueri ? `${pathname}?${kueri}` : pathname, { scroll: false });
  }, [kunci, pathname, router, searchParams, toast]);

  return null;
}
