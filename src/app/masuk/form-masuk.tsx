"use client";

import { useActionState, useState } from "react";

import { AlertCircle, ChevronRight, Eye, EyeOff, Lock, User } from "lucide-react";

import { Input, Label, Pemuat, Tombol } from "@/components/ui";

import { type StatusMasuk, masuk } from "./actions";

export function FormMasuk({ lanjut }: { lanjut?: string }) {
  const [status, aksi, sedangKirim] = useActionState<StatusMasuk, FormData>(masuk, {});
  const [lihatSandi, setLihatSandi] = useState(false);

  /**
   * Username dikendalikan state supaya tidak ikut terhapus saat login gagal.
   *
   * React mengosongkan field tak terkendali setiap kali sebuah form action
   * selesai. Akibatnya salah ketik satu huruf pada kata sandi memaksa petugas
   * mengetik ulang usernamenya juga. Kata sandi sengaja dibiarkan terhapus.
   */
  const [username, setUsername] = useState("");

  return (
    <form action={aksi} className="space-y-4" noValidate>
      {lanjut ? <input type="hidden" name="lanjut" value={lanjut} /> : null}

      {/* Galat ditulis DI DALAM form, bukan sebagai toast.
          Sebelumnya satu-satunya tanda kata sandi salah adalah toast yang
          hilang sendiri dalam beberapa detik. Petugas yang sedang mengetik,
          atau yang menengok layar sesaat setelahnya, melihat form yang
          seolah-olah tidak bereaksi sama sekali saat tombol ditekan — dan
          tidak punya cara lain untuk tahu apa yang salah. */}
      {status.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden />
          {status.error}
        </p>
      ) : null}

      <div>
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <User
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="mis. upt.ngadirejo"
            className="pl-9"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={Boolean(status.bidang?.username)}
            aria-describedby={status.bidang?.username ? "galat-username" : undefined}
            required
          />
        </div>
        {status.bidang?.username ? (
          <p id="galat-username" className="mt-1.5 text-xs text-rose-600">
            {status.bidang.username}
          </p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="sandi">Kata Sandi</Label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            id="sandi"
            name="sandi"
            type={lihatSandi ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Masukkan kata sandi"
            className="pr-10 pl-9"
            aria-invalid={Boolean(status.bidang?.sandi)}
            aria-describedby={status.bidang?.sandi ? "galat-sandi" : undefined}
            required
          />
          <button
            type="button"
            onClick={() => setLihatSandi((v) => !v)}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label={lihatSandi ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          >
            {lihatSandi ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {status.bidang?.sandi ? (
          <p id="galat-sandi" className="mt-1.5 text-xs text-rose-600">
            {status.bidang.sandi}
          </p>
        ) : null}
      </div>

      <Tombol
        type="submit"
        ukuran="lg"
        className="mt-2 w-full"
        disabled={sedangKirim}
        aria-busy={sedangKirim}
      >
        {sedangKirim ? (
          <>
            <Pemuat /> Memproses…
          </>
        ) : (
          <>
            Masuk <ChevronRight className="h-4 w-4" />
          </>
        )}
      </Tombol>

      <p className="pt-1 text-center text-xs text-slate-500 dark:text-slate-400">
        Akun dibuat oleh Administrator. Hubungi Bidang Sumber Daya Air bila mengalami kendala.
      </p>
    </form>
  );
}
