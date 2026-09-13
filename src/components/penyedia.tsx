"use client";

import { Suspense } from "react";

import { NotifDariUrl } from "@/components/notif-dari-url";
import { PenyediaKonfirmasi } from "@/components/ui/konfirmasi";
import { PenyediaTema } from "@/components/ui/tema";
import { PenyediaToast } from "@/components/ui/toast";

/**
 * Membungkus seluruh aplikasi dengan penyedia toast dan dialog konfirmasi.
 * Dipasang di layout akar supaya halaman Masuk — yang berada di luar grup
 * (app) — juga bisa menampilkan notifikasi, mis. setelah berhasil keluar.
 */
export function Penyedia({ children }: { children: React.ReactNode }) {
  return (
    <PenyediaTema>
      <PenyediaToast>
        <PenyediaKonfirmasi>
          {/* useSearchParams butuh batas Suspense saat prerender. */}
          <Suspense fallback={null}>
            <NotifDariUrl />
          </Suspense>
          {children}
        </PenyediaKonfirmasi>
      </PenyediaToast>
    </PenyediaTema>
  );
}
