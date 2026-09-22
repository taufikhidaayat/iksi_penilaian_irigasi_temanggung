"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { AlertCircle, Check, Copy } from "lucide-react";

import { Pemuat, Tombol } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { periodeSebelumnya, type Periode } from "@/lib/periode";
import type { PeriodeTriwulan } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

import { salinPeriode } from "@/app/(app)/penilaian/actions";

/** Dua tahun ke belakang. Lebih jauh dari itu kondisinya sudah tidak sebanding. */
const JUMLAH_KANDIDAT = 8;

export function SalinPeriode({
  tahun,
  triwulan,
  uptId,
  lingkup,
  belumDinilai,
}: {
  tahun: number;
  triwulan: PeriodeTriwulan;
  /** Saringan UPT yang sedang aktif di papan; kosong berarti seluruh UPT. */
  uptId: string;
  /** Sebutan lingkup yang akan terpengaruh, supaya admin tidak salah sasaran. */
  lingkup: string;
  belumDinilai: number;
}) {
  const router = useRouter();
  const toast = useToast();

  // Periode yang ditawarkan dihitung mundur dari periode yang sedang dibuka,
  // jadi periode tujuan tidak mungkin ikut terpilih sebagai sumbernya sendiri.
  const kandidat = useMemo(() => {
    const hasil: Periode[] = [];
    let p: Periode = { tahun, triwulan };
    for (let i = 0; i < JUMLAH_KANDIDAT; i++) {
      p = periodeSebelumnya(p);
      hasil.push(p);
    }
    return hasil;
  }, [tahun, triwulan]);

  const [buka, setBuka] = useState(false);
  const [dipilih, setDipilih] = useState<Periode>(kandidat[0]);
  const [galat, setGalat] = useState<string | null>(null);
  const [menunggu, mulai] = useTransition();

  function kirim() {
    setGalat(null);

    mulai(async () => {
      const r = await salinPeriode({
        tahunSumber: dipilih.tahun,
        triwulanSumber: dipilih.triwulan,
        tahun,
        triwulan,
        uptId: uptId ? Number(uptId) : null,
      });

      if (!r.ok) {
        setGalat(r.pesan ?? "Gagal menyalin penilaian.");
        return;
      }

      setBuka(false);
      router.refresh();

      const sisa = [
        r.sudahAda ? `${r.sudahAda} dilewati karena sudah dinilai` : null,
        r.tanpaSumber ? `${r.tanpaSumber} belum ada sumbernya` : null,
      ]
        .filter(Boolean)
        .join(", ");

      if (r.disalin) {
        toast.sukses(
          `${r.disalin} penilaian disalin`,
          sisa ? `${sisa}. Semuanya masuk sebagai draf dan masih perlu diperiksa.` : undefined,
        );
      } else {
        toast.info(
          "Tidak ada yang disalin",
          sisa || `${dipilih.triwulan} ${dipilih.tahun} belum punya isian yang bisa disalin.`,
        );
      }
    });
  }

  return (
    <>
      <Tombol
        varian="garis"
        onClick={() => setBuka(true)}
        disabled={belumDinilai === 0}
        title={belumDinilai === 0 ? "Semua D.I. pada periode ini sudah dinilai" : undefined}
        className="h-9 text-xs"
      >
        <Copy className="h-4 w-4" />
        Salin dari periode lain
      </Tombol>

      <Dialog
        buka={buka}
        onTutup={() => setBuka(false)}
        judul={`Salin penilaian ke ${triwulan} ${tahun}`}
        deskripsi={`${lingkup} · ${belumDinilai} D.I. belum dinilai di periode ini`}
        lebar="max-w-xl"
      >
        <div className="space-y-4">
          <div>
            <p
              id="salin-sumber-label"
              className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Salin dari periode
            </p>
            <ul
              aria-labelledby="salin-sumber-label"
              className="scroll-halus max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700"
            >
              {kandidat.map((p, i) => {
                const aktif = p.tahun === dipilih.tahun && p.triwulan === dipilih.triwulan;
                return (
                  <li
                    key={`${p.tahun}-${p.triwulan}`}
                    className="border-b border-slate-100 last:border-b-0 dark:border-slate-800"
                  >
                    <button
                      type="button"
                      onClick={() => setDipilih(p)}
                      aria-pressed={aktif}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition-colors",
                        aktif
                          ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800",
                      )}
                    >
                      <span>
                        {p.triwulan} {p.tahun}
                        {i === 0 ? (
                          <span className="ml-2 text-xs font-normal text-slate-400">
                            triwulan sebelumnya
                          </span>
                        ) : null}
                      </span>
                      {aktif ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-lg bg-slate-50 px-3.5 py-3 dark:bg-slate-800/50">
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Yang disalin: nilai indikator, nilai per bangunan, kantong lumpur, jumlah P3A/GP3A,
              dan areal terdampak.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              D.I. yang di {triwulan} {tahun} sudah punya penilaian{" "}
              <strong className="font-semibold">tidak akan tersentuh</strong>, apa pun statusnya.
              Hasil salinan masuk sebagai draf, jadi tetap harus diperiksa dan diajukan seperti
              biasa.
            </p>
          </div>

          {galat ? (
            <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden />
              {galat}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Tombol varian="garis" onClick={() => setBuka(false)}>
              Batal
            </Tombol>
            <Tombol onClick={kirim} disabled={menunggu}>
              {menunggu ? <Pemuat /> : <Copy className="h-4 w-4" />}
              Salin sekarang
            </Tombol>
          </div>
        </div>
      </Dialog>
    </>
  );
}
