"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { ChevronDown, LayoutGrid, Rows3, Search, X } from "lucide-react";

import { KartuDi } from "@/components/penilaian/kartu-di";
import { BilahProgres, Kartu, KosongData, Lencana, Pilihan } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { KartuPenilaian } from "@/lib/data/penilaian";
import { INFO_KATEGORI_IKSI, kategoriIksi } from "@/lib/iksi/scoring";
import { INFO_STATUS, KUKI_TAMPILAN, nadaKategori, type TampilanDaftar } from "@/lib/tampilan";
import type { PeriodeTriwulan, StatusPenilaian } from "@/lib/supabase/types";
import { cn, formatAngka, formatTanggal } from "@/lib/utils";

import { mulaiPenilaian } from "@/app/(app)/penilaian/actions";

/* ------------------------------------------------------------------ */
/* Pengelompokan                                                       */
/* ------------------------------------------------------------------ */

type KunciGrup = StatusPenilaian | "belum";

const GRUP: Record<KunciGrup, { judul: string; keterangan: string }> = {
  diajukan: {
    judul: "Menunggu verifikasi",
    keterangan: "Sudah dikirim UPT, menunggu keputusan Administrator.",
  },
  revisi: {
    judul: "Perlu revisi",
    keterangan: "Dikembalikan Administrator untuk diperbaiki.",
  },
  draft: {
    judul: "Sedang dikerjakan",
    keterangan: "Masih draft. Yang terakhir disentuh ada di paling depan.",
  },
  belum: {
    judul: "Belum dinilai",
    keterangan: "Tekan kartunya untuk langsung mulai mengisi.",
  },
  disetujui: {
    judul: "Selesai",
    keterangan: "Sudah disetujui dan ikut masuk rekapitulasi.",
  },
};

/**
 * Urutan grup mengikuti siapa yang perlu bertindak.
 *
 * Bagi Administrator, yang menunggu verifikasi adalah pekerjaannya sendiri
 * sehingga naik paling atas. Bagi UPT, yang dikembalikan untuk direvisi yang
 * paling mendesak, sedangkan yang sudah diajukan tinggal ditunggu.
 *
 * Yang sudah selesai selalu paling bawah. Daftar ini dikerjakan sampai habis,
 * bukan dikunjungi ulang seperti berkas, jadi menaikkan yang sudah beres cuma
 * meninggikan tumpukan yang harus dilewati menuju sisa pekerjaan.
 */
const URUTAN_ADMIN: KunciGrup[] = ["diajukan", "revisi", "draft", "belum", "disetujui"];
const URUTAN_UPT: KunciGrup[] = ["revisi", "draft", "belum", "diajukan", "disetujui"];

/** Grup arsip, terlipat sejak awal supaya tidak menghabiskan layar. */
const TERLIPAT_AWAL: KunciGrup[] = ["disetujui"];

/* ------------------------------------------------------------------ */
/* Pencarian                                                           */
/* ------------------------------------------------------------------ */

/**
 * Menyeragamkan teks sebelum dicocokkan: huruf kecil, titik dan kurung jadi
 * spasi. Dengan begitu "di aji", "D.I. Aji", dan "aji" sama-sama menemukan
 * "D.I. Aji Bangkong", dan "(MA)" tidak menghalangi pencarian nama depannya.
 */
function seragam(teks: string): string {
  return teks
    .toLowerCase()
    .replace(/[.()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ */

export function PapanPenilaian({
  daftar,
  tahun,
  triwulan,
  isAdmin,
  uptId,
  daftarUpt,
  tampilanAwal,
}: {
  daftar: KartuPenilaian[];
  tahun: number;
  triwulan: PeriodeTriwulan;
  isAdmin: boolean;
  uptId: string;
  daftarUpt?: { id: number; nama: string }[];
  tampilanAwal: TampilanDaftar;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [cari, setCari] = useState("");
  const [tampilan, setTampilan] = useState<TampilanDaftar>(tampilanAwal);
  const [dilipat, setDilipat] = useState<Set<KunciGrup>>(() => new Set(TERLIPAT_AWAL));
  const [menunggu, setMenunggu] = useState<number | null>(null);
  const [, mulai] = useTransition();
  const refCari = useRef<HTMLInputElement>(null);

  /* --- pencarian: disaring di browser, tanpa menembak server --- */

  const berindeks = useMemo(
    () =>
      daftar.map((k) => ({
        k,
        teks: seragam(`${k.nama} ${k.kode} ${k.kecamatan ?? ""}`),
      })),
    [daftar],
  );

  const kata = useMemo(() => seragam(cari).split(" ").filter(Boolean), [cari]);
  const mencari = kata.length > 0;

  const tersaring = useMemo(
    () =>
      mencari
        ? berindeks.filter((b) => kata.every((t) => b.teks.includes(t))).map((b) => b.k)
        : daftar,
    [berindeks, daftar, kata, mencari],
  );

  /* --- pengelompokan --- */

  const grup = useMemo(() => {
    const peta = new Map<KunciGrup, KartuPenilaian[]>();

    for (const k of tersaring) {
      const kunci: KunciGrup = k.status ?? "belum";
      const isi = peta.get(kunci);
      if (isi) isi.push(k);
      else peta.set(kunci, [k]);
    }

    for (const [kunci, isi] of peta) {
      if (kunci === "belum") isi.sort((a, b) => a.nama.localeCompare(b.nama, "id"));
      else isi.sort((a, b) => (b.diperbarui ?? "").localeCompare(a.diperbarui ?? ""));
    }

    return peta;
  }, [tersaring]);

  const urutan = isAdmin ? URUTAN_ADMIN : URUTAN_UPT;

  // Saat sedang mencari, semua grup dibuka paksa. Kalau tidak, hasil yang
  // kebetulan berstatus "Selesai" akan tampak seolah tidak ada.
  const tertutup = (kunci: KunciGrup) => !mencari && dilipat.has(kunci);

  function lipat(kunci: KunciGrup) {
    setDilipat((lama) => {
      const baru = new Set(lama);
      if (baru.has(kunci)) baru.delete(kunci);
      else baru.add(kunci);
      return baru;
    });
  }

  /* --- pintasan papan ketik --- */

  useEffect(() => {
    function saatTekan(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      e.preventDefault();
      refCari.current?.focus();
    }
    window.addEventListener("keydown", saatTekan);
    return () => window.removeEventListener("keydown", saatTekan);
  }, []);

  /* --- aksi --- */

  const gantiTampilan = useCallback((t: TampilanDaftar) => {
    setTampilan(t);
    // Setahun, supaya pilihan ini bertahan tanpa perlu disimpan per pengguna
    // di basis data.
    document.cookie = `${KUKI_TAMPILAN}=${t}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  function gantiUpt(nilai: string) {
    const params = new URLSearchParams(searchParams);
    if (nilai) params.set("upt", nilai);
    else params.delete("upt");
    router.push(`${pathname}?${params}`);
  }

  function mulaiDi(k: KartuPenilaian) {
    if (menunggu !== null) return;
    setMenunggu(k.diId);

    mulai(async () => {
      const r = await mulaiPenilaian({ diId: k.diId, tahun, triwulan });
      if (r.ok && r.id) {
        // Sengaja tidak dikosongkan lagi: pemuat tetap berputar sampai halaman
        // penilaiannya benar-benar terbuka.
        router.push(`/penilaian/${r.id}`);
      } else {
        setMenunggu(null);
        toast.galat("Gagal membuat penilaian", r.pesan);
      }
    });
  }

  const sudah = daftar.filter((k) => k.penilaianId !== null).length;

  return (
    <>
      <div className="sticky top-14 z-20 mb-4 bg-[var(--latar)] py-3 lg:top-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[13rem] flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              ref={refCari}
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setCari("");
              }}
              placeholder="Cari nama, kode, atau kecamatan…"
              aria-label="Cari daerah irigasi"
              autoComplete="off"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pr-16 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            {cari ? (
              <button
                type="button"
                onClick={() => {
                  setCari("");
                  refCari.current?.focus();
                }}
                aria-label="Kosongkan pencarian"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 dark:border-slate-700">
                /
              </kbd>
            )}
          </div>

          {daftarUpt ? (
            <Pilihan
              value={uptId}
              onChange={(e) => gantiUpt(e.target.value)}
              className="h-9 w-52 text-xs"
              aria-label="Saring UPT"
            >
              <option value="">Semua UPT</option>
              {daftarUpt.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nama}
                </option>
              ))}
            </Pilihan>
          ) : null}

          <div
            role="group"
            aria-label="Bentuk tampilan"
            className="flex h-9 shrink-0 items-center gap-0.5 rounded-lg border border-slate-300 p-0.5 dark:border-slate-700"
          >
            {(
              [
                ["kartu", LayoutGrid, "Tampilan kartu"],
                ["tabel", Rows3, "Tampilan baris"],
              ] as const
            ).map(([nilai, Ikon, label]) => (
              <button
                key={nilai}
                type="button"
                onClick={() => gantiTampilan(nilai)}
                aria-pressed={tampilan === nilai}
                title={label}
                aria-label={label}
                className={cn(
                  "flex h-full w-8 items-center justify-center rounded-md transition-colors",
                  tampilan === nilai
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200",
                )}
              >
                <Ikon className="h-4 w-4" aria-hidden />
              </button>
            ))}
          </div>
        </div>

        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
          {mencari
            ? `${tersaring.length} dari ${daftar.length} D.I. cocok dengan "${cari.trim()}"`
            : `${daftar.length} D.I. · ${sudah} sudah dinilai · ${daftar.length - sudah} belum`}
        </p>
      </div>

      {tersaring.length === 0 ? (
        <Kartu>
          <KosongData
            judul={mencari ? "Tidak ada yang cocok" : "Belum ada daerah irigasi"}
            pesan={
              mencari
                ? "Coba kata kunci lain, atau ubah saringan UPT di sebelah kolom pencarian."
                : "Belum ada D.I. aktif pada lingkup ini."
            }
          />
        </Kartu>
      ) : (
        <div className="space-y-6">
          {urutan.map((kunci) => {
            const isi = grup.get(kunci);
            if (!isi?.length) return null;

            return (
              <section key={kunci}>
                <KepalaGrup
                  kunci={kunci}
                  jumlah={isi.length}
                  tertutup={tertutup(kunci)}
                  bisaDilipat={!mencari}
                  onLipat={() => lipat(kunci)}
                />

                {tertutup(kunci) ? null : tampilan === "kartu" ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {isi.map((k) => (
                      <KartuDi
                        key={k.diId}
                        k={k}
                        tampilkanUpt={isAdmin}
                        menunggu={menunggu === k.diId}
                        onMulai={() => mulaiDi(k)}
                      />
                    ))}
                  </div>
                ) : (
                  <TabelGrup isi={isi} isAdmin={isAdmin} menunggu={menunggu} onMulai={mulaiDi} />
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function KepalaGrup({
  kunci,
  jumlah,
  tertutup,
  bisaDilipat,
  onLipat,
}: {
  kunci: KunciGrup;
  jumlah: number;
  tertutup: boolean;
  bisaDilipat: boolean;
  onLipat: () => void;
}) {
  const info = GRUP[kunci];

  return (
    <div className="mb-2.5 bg-[var(--latar)] py-1 lg:sticky lg:top-[3.75rem] lg:z-10">
      <button
        type="button"
        onClick={onLipat}
        disabled={!bisaDilipat}
        aria-expanded={!tertutup}
        className="flex items-center gap-1.5 disabled:cursor-default"
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-400 transition-transform",
            tertutup && "-rotate-90",
            !bisaDilipat && "invisible",
          )}
          aria-hidden
        />
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{info.judul}</h2>
        <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 tabular-nums dark:bg-slate-800 dark:text-slate-300">
          {jumlah}
        </span>
      </button>
      <p className="mt-0.5 ml-[1.375rem] text-xs text-slate-400 dark:text-slate-500">
        {info.keterangan}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TabelGrup({
  isi,
  isAdmin,
  menunggu,
  onMulai,
}: {
  isi: KartuPenilaian[];
  isAdmin: boolean;
  menunggu: number | null;
  onMulai: (k: KartuPenilaian) => void;
}) {
  const router = useRouter();

  return (
    <Kartu className="overflow-hidden">
      <div className="scroll-halus overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="px-5 py-3 font-medium">Daerah Irigasi</th>
              {isAdmin ? <th className="px-5 py-3 font-medium">UPT</th> : null}
              <th className="px-5 py-3 font-medium">Kelengkapan</th>
              <th className="px-5 py-3 text-right font-medium">Nilai IKSI</th>
              <th className="px-5 py-3 font-medium">Kategori</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Diperbarui</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isi.map((k) => {
              const kat = k.total === null ? null : kategoriIksi(k.total);
              const terisi = k.jmlTerisi ?? 0;
              const dari = k.jmlIndikator ?? 0;
              const lengkap = dari > 0 && terisi >= dari;
              const belum = k.penilaianId === null;
              const sedangDibuat = menunggu === k.diId;

              return (
                <tr
                  key={k.diId}
                  onClick={() => (belum ? onMulai(k) : router.push(`/penilaian/${k.penilaianId}`))}
                  className="group cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <td className="px-5 py-3">
                    <span className="block font-medium text-slate-800 group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-300">
                      {k.nama}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-slate-400">
                      {k.kode}
                      {k.kecamatan ? ` · ${k.kecamatan}` : ""}
                    </span>
                  </td>

                  {isAdmin ? (
                    <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-400">
                      {k.uptNama}
                    </td>
                  ) : null}

                  <td className="px-5 py-3">
                    {belum ? (
                      <span className="text-xs text-slate-300 dark:text-slate-600">–</span>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <BilahProgres
                          nilai={terisi}
                          maks={dari || 1}
                          className="w-20"
                          warnaBilah={lengkap ? "bg-emerald-500" : "bg-brand-600"}
                        />
                        <span className="font-mono text-xs text-slate-500 tabular-nums">
                          {terisi}/{dari || "–"}
                        </span>
                      </div>
                    )}
                  </td>

                  <td className="px-5 py-3 text-right font-medium text-slate-800 tabular-nums dark:text-slate-100">
                    {k.total === null ? (
                      <span className="text-slate-300 dark:text-slate-600">–</span>
                    ) : (
                      formatAngka(k.total, 2)
                    )}
                  </td>

                  <td className="px-5 py-3">
                    {kat ? (
                      <Lencana nada={nadaKategori(kat)}>{INFO_KATEGORI_IKSI[kat].singkat}</Lencana>
                    ) : (
                      <span className="text-xs text-slate-300 dark:text-slate-600">–</span>
                    )}
                  </td>

                  <td className="px-5 py-3">
                    {k.status ? (
                      <Lencana nada={INFO_STATUS[k.status].nada}>
                        {INFO_STATUS[k.status].label}
                      </Lencana>
                    ) : (
                      <span className="text-xs text-slate-400">Belum dinilai</span>
                    )}
                  </td>

                  <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {belum ? "–" : formatTanggal(k.diperbarui)}
                  </td>

                  <td className="pr-4">
                    {belum ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMulai(k);
                        }}
                        disabled={sedangDibuat}
                        aria-label={`Mulai penilaian ${k.nama}`}
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 disabled:cursor-wait disabled:opacity-60 dark:text-brand-300 dark:hover:bg-brand-500/15"
                      >
                        {sedangDibuat ? "Membuat…" : "Mulai nilai"}
                      </button>
                    ) : (
                      <Link
                        href={`/penilaian/${k.penilaianId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-brand-500/15"
                      >
                        Buka
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Kartu>
  );
}
