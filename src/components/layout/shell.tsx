"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  BarChart3,
  Boxes,
  FileDown,
  FileStack,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { FaUserGear } from "react-icons/fa6";

import { useKonfirmasi } from "@/components/ui/konfirmasi";
import { type ItemNav, type KunciIkon, aktif } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Pemetaan kunci ikon -> komponen. Harus di sisi klien: komponen lucide adalah
 * objek forwardRef yang tidak bisa dikirim menembus batas server/klien.
 */
const IKON: Record<KunciIkon, LucideIcon> = {
  dasbor: LayoutDashboard,
  penilaian: FileSpreadsheet,
  rekap: BarChart3,
  ekspor: FileDown,
  daerahIrigasi: MapPin,
  aset: Boxes,
  asetDraf: FileStack,
  pengguna: Users,
};

interface ShellProps {
  menu: ItemNav[];
  nama: string;
  peran: string;
  namaUpt: string;
  /** Kode singkat UPT ("R1"…"R6") dipakai sebagai inisial avatar; null untuk admin. */
  kodeUpt: string | null;
  /** Admin memakai ikon khusus sebagai avatar, bukan inisial. */
  isAdmin: boolean;
  onKeluar: () => Promise<void>;
  children: React.ReactNode;
}

export function Shell({ menu, nama, peran, namaUpt, kodeUpt, isAdmin, onKeluar, children }: ShellProps) {
  const pathname = usePathname();
  const konfirmasi = useKonfirmasi();
  const [bukaMobile, setBukaMobile] = useState(false);
  const [sedangKeluar, setSedangKeluar] = useState(false);

  async function mintaKeluar() {
    const setuju = await konfirmasi({
      judul: "Keluar dari SIKSI?",
      pesan: `Anda akan keluar dari akun ${nama}. Perlu masuk lagi untuk melanjutkan.`,
      catatan: "Perubahan penilaian yang belum tersimpan akan hilang.",
      tombolYa: "Ya, keluar",
      tombolTidak: "Batal",
      nada: "peringatan",
    });
    if (!setuju) return;
    setSedangKeluar(true);
    await onKeluar();
  }

  // Akun bersifat per-posisi ("Petugas Regional I - Temanggung"), bukan nama
  // orang — jadi kata jabatan generiknya disembunyikan dari baris nama...
  const namaTampil = nama.replace(/^petugas\s+/i, "").trim() || nama;

  // ...dan inisial avatar memakai kode UPT ("R1"…"R6") yang tidak ambigu,
  // bukan huruf pertama "Petugas Regional" yang jadi "PR" untuk semua UPT.
  const inisial =
    kodeUpt ||
    namaTampil
      .split(/\s+/)
      .slice(0, 2)
      .map((k) => k[0]?.toUpperCase() ?? "")
      .join("");

  const daftarMenu = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3">
      {menu.map((item) => {
        const ini = aktif(pathname, item);
        const Ikon = IKON[item.ikon];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setBukaMobile(false)}
            aria-current={ini ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              ini
                ? "bg-white text-brand-700 shadow-sm"
                : "text-brand-100 hover:bg-white/10 hover:text-white",
            )}
          >
            <Ikon className="h-4.5 w-4.5 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const isiSidebar = (
    <>
      <div className="flex flex-col items-center gap-2.5 px-6 py-6 text-center">
        <Image
          src="/img/lambang-temanggung.png"
          alt="Lambang Kabupaten Temanggung"
          width={320}
          height={487}
          className="h-16 w-auto drop-shadow-sm"
        />
        <div>
          <p className="text-sm font-semibold tracking-tight text-white">SIKSI</p>
          {/* Kepanjangan IKSI ditulis utuh di sini, sama dengan halaman masuk. */}
          <p className="mt-0.5 text-[11px] leading-snug text-brand-300">
            Penilaian Indeks Kinerja Sistem Irigasi
          </p>
          <p className="mt-1 text-[11px] text-brand-400">Kab. Temanggung</p>
        </div>
      </div>

      <div className="mx-6 mt-1 mb-4 h-px bg-linear-to-r from-transparent via-white/25 to-transparent" />

      {daftarMenu}

      <div className="mt-auto border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
            {isAdmin ? <FaUserGear className="h-4 w-5" aria-hidden /> : inisial || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{namaTampil}</p>
            <p className="truncate text-[11px] text-brand-300">{namaUpt}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void mintaKeluar()}
          disabled={sedangKeluar}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-100 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
        >
          <LogOut className="h-4.5 w-4.5" aria-hidden />
          {sedangKeluar ? "Keluar…" : "Keluar"}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-brand-900 lg:flex">
        {isiSidebar}
      </aside>

      {/* Sidebar mobile */}
      {bukaMobile ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setBukaMobile(false)}
            aria-label="Tutup menu"
          />
          <aside className="relative flex h-full w-64 flex-col bg-brand-900">
            <button
              onClick={() => setBukaMobile(false)}
              className="absolute top-4 right-3 rounded-md p-1.5 text-brand-200 hover:bg-white/10"
              aria-label="Tutup menu"
            >
              <X className="h-5 w-5" />
            </button>
            {isiSidebar}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur-md lg:hidden dark:border-slate-800 dark:bg-slate-900/85">
          <button
            onClick={() => setBukaMobile(true)}
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-brand-700">SIKSI</span>
          <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
            {peran}
          </span>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
