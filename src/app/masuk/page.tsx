import type { Metadata } from "next";
import Image from "next/image";

import { SaklarTema } from "@/components/ui/tema";

import { FormMasuk } from "./form-masuk";
import { PanelMerek } from "./panel-merek";

export const metadata: Metadata = { title: "Masuk" };

const TAHUN = new Date().getFullYear();

export default async function HalamanMasuk({ searchParams }: PageProps<"/masuk">) {
  const { lanjut } = await searchParams;

  return (
    <main className="latar-mesh relative flex min-h-dvh flex-col">
      {/* Lapis halus di atas mesh supaya teks tetap terbaca di kedua tema. */}
      <div className="pointer-events-none absolute inset-0 bg-white/30 dark:bg-slate-950/40" />

      <header className="relative flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <span className="flex items-center gap-3">
          <Image
            src="/img/lambang-temanggung.png"
            alt="Lambang Kabupaten Temanggung"
            width={320}
            height={487}
            priority
            className="h-9 w-auto drop-shadow-sm"
          />
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              SIKSI
            </span>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">
              Dinas PUPR Kabupaten Temanggung
            </span>
          </span>
        </span>

        <SaklarTema />
      </header>

      <div className="relative flex flex-1 items-center justify-center px-4 pb-10 sm:px-8">
        <div
          className={
            "grid w-full max-w-5xl gap-6 rounded-3xl border border-slate-200 bg-white p-3 " +
            "shadow-[0_24px_70px_-24px_rgb(15_23_42/0.35)] lg:grid-cols-2 " +
            "dark:border-white/10 dark:bg-slate-900 dark:shadow-[0_24px_70px_-24px_rgb(0_0_0/0.7)]"
          }
        >
          {/* Form di kiri, ilustrasi di kanan. */}
          <div className="flex items-center justify-center px-4 py-10 sm:px-10">
            <div className="w-full max-w-sm">
              <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Masuk
              </h1>
              <p className="mt-1.5 mb-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Masukkan username dan kata sandi.
              </p>

              <FormMasuk lanjut={typeof lanjut === "string" ? lanjut : undefined} />
            </div>
          </div>

          <PanelMerek />
        </div>
      </div>

      <footer className="relative px-5 pb-6 text-center text-xs text-slate-500 dark:text-slate-400">
        © {TAHUN} Dinas Pekerjaan Umum dan Penataan Ruang Kabupaten Temanggung
      </footer>
    </main>
  );
}
