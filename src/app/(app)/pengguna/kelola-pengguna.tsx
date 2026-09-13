"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";

import { AlertCircle, Eye, EyeOff, KeyRound, Plus, UserCheck, UserX } from "lucide-react";

import { Input, Label, Lencana, Pemuat, Pilihan, Tombol } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { useKonfirmasi } from "@/components/ui/konfirmasi";
import { useToast } from "@/components/ui/toast";
import { formatTanggal } from "@/lib/utils";

import { type HasilPengguna, aturUlangSandi, buatPengguna, ubahAktif } from "./actions";

export interface BarisPengguna {
  id: string;
  username: string;
  nama: string;
  peran: "admin" | "upt";
  uptNama: string | null;
  aktif: boolean;
  dibuat: string;
}

export function KelolaPengguna({
  daftar,
  daftarUpt,
  idSaya,
}: {
  daftar: BarisPengguna[];
  daftarUpt: { id: number; nama: string }[];
  idSaya: string;
}) {
  const router = useRouter();
  const [bukaBuat, setBukaBuat] = useState(false);
  const [resetUntuk, setResetUntuk] = useState<BarisPengguna | null>(null);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Tombol onClick={() => setBukaBuat(true)}>
          <Plus className="h-4 w-4" />
          Tambah Pengguna
        </Tombol>
      </div>

      <div className="scroll-halus overflow-x-auto rounded-card border border-slate-200 bg-white">
        <table className="w-full min-w-180 text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="px-5 py-3 font-medium">Nama</th>
              <th className="px-5 py-3 font-medium">Username</th>
              <th className="px-5 py-3 font-medium">Peran</th>
              <th className="px-5 py-3 font-medium">UPT</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Dibuat</th>
              <th className="px-5 py-3 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {daftar.map((p) => (
              <BarisTabel
                key={p.id}
                p={p}
                idSaya={idSaya}
                onReset={() => setResetUntuk(p)}
                onSelesai={() => router.refresh()}
              />
            ))}
          </tbody>
        </table>
      </div>

      <DialogBuatPengguna
        buka={bukaBuat}
        onTutup={() => setBukaBuat(false)}
        daftarUpt={daftarUpt}
        onSelesai={() => {
          setBukaBuat(false);
          router.refresh();
        }}
      />

      {/* `key` membuat dialog ter-mount ulang tiap ganti pengguna, sehingga
          isian kata sandi & pesan bersih tanpa perlu disinkronkan lewat efek. */}
      <DialogResetSandi
        key={resetUntuk?.id ?? "kosong"}
        pengguna={resetUntuk}
        onTutup={() => setResetUntuk(null)}
      />
    </>
  );
}

function BarisTabel({
  p,
  idSaya,
  onReset,
  onSelesai,
}: {
  p: BarisPengguna;
  idSaya: string;
  onReset: () => void;
  onSelesai: () => void;
}) {
  const [menunggu, mulai] = useTransition();
  const [galat, setGalat] = useState<string | null>(null);
  const toast = useToast();
  const konfirmasi = useKonfirmasi();

  async function ubahStatusAkun() {
    const menonaktifkan = p.aktif;
    const setuju = await konfirmasi({
      judul: menonaktifkan ? `Nonaktifkan akun ${p.nama}?` : `Aktifkan kembali akun ${p.nama}?`,
      pesan: menonaktifkan
        ? "Akun tidak akan bisa masuk lagi sampai diaktifkan kembali."
        : "Akun akan bisa masuk lagi dengan kata sandi yang sama seperti sebelumnya.",
      catatan: menonaktifkan
        ? "Penilaian yang sudah dibuat akun ini tetap tersimpan."
        : undefined,
      tombolYa: menonaktifkan ? "Ya, nonaktifkan" : "Ya, aktifkan",
      nada: menonaktifkan ? "bahaya" : "biasa",
    });
    if (!setuju) return;

    mulai(async () => {
      setGalat(null);
      const r = await ubahAktif(p.id, !p.aktif);
      if (r.ok) {
        toast.sukses(
          menonaktifkan ? "Akun dinonaktifkan" : "Akun diaktifkan",
          `${p.nama} (${p.username}).`,
        );
        onSelesai();
      } else {
        setGalat(r.pesan ?? "Gagal.");
        toast.galat("Gagal mengubah status akun", r.pesan);
      }
    });
  }

  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-5 py-3">
        <span className="font-medium text-slate-800">{p.nama}</span>
        {p.id === idSaya ? (
          <span className="ml-2 text-[11px] text-slate-400">(Anda)</span>
        ) : null}
        {galat ? <p className="mt-0.5 text-xs text-rose-600">{galat}</p> : null}
      </td>
      <td className="px-5 py-3">
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
          {p.username}
        </code>
      </td>
      <td className="px-5 py-3">
        <Lencana nada={p.peran === "admin" ? "biru" : "netral"}>
          {p.peran === "admin" ? "Administrator" : "UPT"}
        </Lencana>
      </td>
      <td className="px-5 py-3 text-xs text-slate-600">{p.uptNama ?? "Semua UPT"}</td>
      <td className="px-5 py-3">
        <Lencana nada={p.aktif ? "hijau" : "merah"}>{p.aktif ? "Aktif" : "Nonaktif"}</Lencana>
      </td>
      <td className="px-5 py-3 text-xs text-slate-500">{formatTanggal(p.dibuat)}</td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <Tombol varian="garis" ukuran="sm" onClick={onReset}>
            <KeyRound className="h-3.5 w-3.5" />
            Sandi
          </Tombol>
          <Tombol
            varian={p.aktif ? "garis" : "sekunder"}
            ukuran="sm"
            disabled={menunggu || p.id === idSaya}
            title={p.id === idSaya ? "Tidak bisa menonaktifkan akun sendiri" : undefined}
            onClick={() => void ubahStatusAkun()}
          >
            {menunggu ? (
              <Pemuat />
            ) : p.aktif ? (
              <UserX className="h-3.5 w-3.5" />
            ) : (
              <UserCheck className="h-3.5 w-3.5" />
            )}
            {p.aktif ? "Nonaktifkan" : "Aktifkan"}
          </Tombol>
        </div>
      </td>
    </tr>
  );
}

function DialogBuatPengguna({
  buka,
  onTutup,
  daftarUpt,
  onSelesai,
}: {
  buka: boolean;
  onTutup: () => void;
  daftarUpt: { id: number; nama: string }[];
  onSelesai: () => void;
}) {
  const [status, aksi, sedangKirim] = useActionState<HasilPengguna, FormData>(buatPengguna, {
    ok: false,
  });
  const [peran, setPeran] = useState<"admin" | "upt">("upt");
  const toast = useToast();

  useEffect(() => {
    if (!status.ok) return;
    toast.sukses("Akun dibuat", "Sampaikan username dan kata sandi awal ke petugas.");
    onSelesai();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <Dialog
      buka={buka}
      onTutup={onTutup}
      judul="Tambah Pengguna"
      deskripsi="Akun langsung aktif dan dapat digunakan untuk masuk."
    >
      <form action={aksi} className="space-y-4">
        {status.pesan ? (
          <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden />
            {status.pesan}
          </p>
        ) : null}

        <div>
          <Label htmlFor="p-nama">Nama Lengkap</Label>
          <Input id="p-nama" name="nama" required placeholder="Nama petugas" />
        </div>

        <div>
          <Label htmlFor="p-username">Username</Label>
          <Input
            id="p-username"
            name="username"
            type="text"
            required
            autoCapitalize="none"
            spellCheck={false}
            placeholder="mis. upt.ngadirejo"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Huruf kecil, angka, titik, garis bawah, atau strip. 3–32 karakter.
            Inilah yang diketik petugas saat masuk.
          </p>
        </div>

        <div>
          <Label htmlFor="p-sandi">Kata Sandi Awal</Label>
          <Input
            id="p-sandi"
            name="sandi"
            type="text"
            required
            minLength={8}
            placeholder="Minimal 8 karakter"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Sampaikan ke petugas melalui kanal yang aman, lalu minta segera diganti.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="p-peran">Peran</Label>
            <Pilihan
              id="p-peran"
              name="peran"
              value={peran}
              onChange={(e) => setPeran(e.target.value as "admin" | "upt")}
            >
              <option value="upt">UPT</option>
              <option value="admin">Administrator</option>
            </Pilihan>
          </div>
          <div>
            <Label htmlFor="p-upt">UPT</Label>
            <Pilihan id="p-upt" name="uptId" disabled={peran === "admin"} required={peran === "upt"}>
              <option value="">{peran === "admin" ? "Semua UPT" : "Pilih UPT…"}</option>
              {daftarUpt.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nama}
                </option>
              ))}
            </Pilihan>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Tombol varian="garis" onClick={onTutup}>
            Batal
          </Tombol>
          <Tombol type="submit" disabled={sedangKirim}>
            {sedangKirim ? <Pemuat /> : null}
            Buat Akun
          </Tombol>
        </div>
      </form>
    </Dialog>
  );
}

function DialogResetSandi({
  pengguna,
  onTutup,
}: {
  pengguna: BarisPengguna | null;
  onTutup: () => void;
}) {
  const [sandi, setSandi] = useState("");
  const [lihatSandi, setLihatSandi] = useState(false);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const [menunggu, mulai] = useTransition();
  const toast = useToast();
  const konfirmasi = useKonfirmasi();

  async function simpanSandi() {
    if (!pengguna) return;
    const setuju = await konfirmasi({
      judul: `Ganti kata sandi ${pengguna.nama}?`,
      pesan: "Kata sandi lama langsung tidak berlaku.",
      catatan: "Sampaikan kata sandi baru ke yang bersangkutan lewat kanal yang aman.",
      tombolYa: "Ya, ganti",
      nada: "peringatan",
    });
    if (!setuju) return;

    mulai(async () => {
      const r = await aturUlangSandi(pengguna.id, sandi);
      setPesan({ ok: r.ok, teks: r.ok ? "Kata sandi berhasil diganti." : (r.pesan ?? "Gagal.") });
      if (r.ok) {
        setSandi("");
        setLihatSandi(false);
        toast.sukses("Kata sandi diganti", `Akun ${pengguna.username}.`);
      } else {
        toast.galat("Gagal mengganti kata sandi", r.pesan);
      }
    });
  }

  return (
    <Dialog
      buka={pengguna !== null}
      onTutup={onTutup}
      judul="Atur Ulang Kata Sandi"
      deskripsi={pengguna ? `Untuk akun ${pengguna.nama}` : undefined}
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="r-sandi">Kata Sandi Baru</Label>
          <div className="relative">
            <Input
              id="r-sandi"
              type={lihatSandi ? "text" : "password"}
              value={sandi}
              onChange={(e) => setSandi(e.target.value)}
              minLength={8}
              placeholder="Minimal 8 karakter"
              className="pr-10"
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
        </div>

        {pesan ? (
          <p className={pesan.ok ? "text-sm text-emerald-600" : "text-sm text-rose-600"}>
            {pesan.teks}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Tombol varian="garis" onClick={onTutup}>
            Tutup
          </Tombol>
          <Tombol
            disabled={menunggu || sandi.length < 8 || !pengguna}
            onClick={() => void simpanSandi()}
          >
            {menunggu ? <Pemuat /> : null}
            Simpan
          </Tombol>
        </div>
      </div>
    </Dialog>
  );
}
