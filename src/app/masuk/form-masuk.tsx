"use client";

import { useActionState, useEffect, useState } from "react";

import { ChevronRight, Eye, EyeOff, Lock, User } from "lucide-react";

import { Input, Label, Pemuat, Tombol } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

import { type StatusMasuk, masuk } from "./actions";

export function FormMasuk({ lanjut }: { lanjut?: string }) {
  const [status, aksi, sedangKirim] = useActionState<StatusMasuk, FormData>(masuk, {});
  const [lihatSandi, setLihatSandi] = useState(false);
  const { galat } = useToast();

  useEffect(() => {
    // Bergantung pada `status`, bukan `status.error`: setiap submit gagal
    // menghasilkan objek status baru dari server action, walau pesannya
    // sama persis dengan sebelumnya (mis. salah dua kali berturut-turut).
    // Bila effect bergantung pada string pesannya saja, React menganggap
    // nilainya "tidak berubah" dan toast kedua tidak pernah tampil.
    if (status.error) galat(status.error);
  }, [status, galat]);

  return (
    <form action={aksi} className="space-y-4" noValidate>
      {lanjut ? <input type="hidden" name="lanjut" value={lanjut} /> : null}

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
