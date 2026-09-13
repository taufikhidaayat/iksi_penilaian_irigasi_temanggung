"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { AlertCircle, Plus, Search } from "lucide-react";

import { Input, Label, Pemuat, Pilihan, Tombol } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { DaerahIrigasi, PeriodeTriwulan } from "@/lib/supabase/types";
import { cn, formatAngka } from "@/lib/utils";

import type { HasilAksi } from "@/app/(app)/penilaian/actions";

export function DialogBuat({
  kandidat,
  tahun,
  triwulan,
  onBuat,
}: {
  kandidat: DaerahIrigasi[];
  tahun: number;
  triwulan: PeriodeTriwulan;
  onBuat: (formData: FormData) => Promise<HasilAksi>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [buka, setBuka] = useState(false);
  const [cari, setCari] = useState("");
  const [dipilih, setDipilih] = useState<number | null>(null);
  const [kantongLumpur, setKantongLumpur] = useState<"ada" | "tidak">("ada");
  const [galat, setGalat] = useState<string | null>(null);
  const [menunggu, mulai] = useTransition();

  const hasil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const dasar = q
      ? kandidat.filter((d) => d.nama.toLowerCase().includes(q) || d.kode.includes(q))
      : kandidat;
    return dasar.slice(0, 60);
  }, [cari, kandidat]);

  function kirim() {
    if (!dipilih) return;
    setGalat(null);
    const fd = new FormData();
    fd.set("diId", String(dipilih));
    fd.set("tahun", String(tahun));
    fd.set("triwulan", triwulan);
    fd.set("kantongLumpur", kantongLumpur);

    const di = kandidat.find((d) => d.id === dipilih);

    mulai(async () => {
      const r = await onBuat(fd);
      if (r.ok && r.id) {
        setBuka(false);
        toast.sukses("Penilaian dibuat", `${di?.nama ?? "D.I."} — ${triwulan} ${tahun}.`);
        router.push(`/penilaian/${r.id}`);
      } else {
        setGalat(r.pesan ?? "Gagal membuat penilaian.");
        toast.galat("Gagal membuat penilaian", r.pesan);
      }
    });
  }

  return (
    <>
      <Tombol onClick={() => setBuka(true)} disabled={kandidat.length === 0}>
        <Plus className="h-4 w-4" />
        Buat Penilaian
      </Tombol>

      <Dialog
        buka={buka}
        onTutup={() => setBuka(false)}
        judul="Buat Penilaian Baru"
        deskripsi={`Periode ${triwulan} ${tahun} · ${kandidat.length} D.I. belum dinilai`}
        lebar="max-w-xl"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="cari-di">Pilih Daerah Irigasi</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <Input
                id="cari-di"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari nama atau kode D.I.…"
                className="pl-9"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="scroll-halus max-h-64 overflow-y-auto rounded-lg border border-slate-200">
            {hasil.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                Tidak ada D.I. yang cocok.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {hasil.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setDipilih(d.id)}
                      aria-pressed={dipilih === d.id}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors",
                        dipilih === d.id ? "bg-brand-50" : "hover:bg-slate-50",
                      )}
                    >
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block truncate text-sm",
                            dipilih === d.id
                              ? "font-medium text-brand-700"
                              : "font-medium text-slate-800",
                          )}
                        >
                          {d.nama}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-400">
                          {d.kode} · {d.kecamatan ?? "–"}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs text-slate-400">
                        {formatAngka(d.luas_baku, 1)} Ha
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <Label htmlFor="kl">Apakah D.I. ini memiliki kantong lumpur?</Label>
            <Pilihan
              id="kl"
              value={kantongLumpur}
              onChange={(e) => setKantongLumpur(e.target.value as "ada" | "tidak")}
            >
              <option value="ada">Ada kantong lumpur</option>
              <option value="tidak">Tidak ada kantong lumpur</option>
            </Pilihan>
            <p className="mt-1.5 text-xs text-slate-500">
              Menentukan bobot Bendung dan Pintu bendung. Masih bisa diubah di dalam form.
            </p>
          </div>

          {galat ? (
            <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden />
              {galat}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Tombol varian="garis" onClick={() => setBuka(false)}>
              Batal
            </Tombol>
            <Tombol onClick={kirim} disabled={!dipilih || menunggu}>
              {menunggu ? <Pemuat /> : null}
              Buat &amp; Isi Sekarang
            </Tombol>
          </div>
        </div>
      </Dialog>
    </>
  );
}
