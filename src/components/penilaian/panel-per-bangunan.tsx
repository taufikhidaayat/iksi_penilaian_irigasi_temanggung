"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Info,
  MapPin,
  Search,
} from "lucide-react";

import {
  BilahProgres,
  Kartu,
  KartuIsi,
  KartuJudul,
  KartuKepala,
  Lencana,
  Tombol,
} from "@/components/ui";
import {
  JENIS_ASET,
  urutanJenis,
  letakAset,
  namaDiBerbeda,
  penandaKembar,
  rincianAset,
  ruasAset,
  sebutanAset,
} from "@/lib/aset";
import { dinilaiPerUnit, kelompokUntukAset } from "@/lib/iksi/per-bangunan";
import { bobotEfektif } from "@/lib/iksi/scoring";
import type { KantongLumpur } from "@/lib/iksi/types";
import type { JenisAset } from "@/lib/supabase/types";
import { cn, formatPanjang } from "@/lib/utils";

import { KartuIndikator } from "./kartu-indikator";
import type { KelompokAset } from "./panel-aset-di";

/** Bangunan per halaman daftar. Satu D.I. punya sampai 987 ruas saluran. */
const PER_HALAMAN = 40;

/** Kunci sel nilai: satu indikator pada satu bangunan. */
export function kunciSel(asetId: number, kode: string): string {
  return `${asetId}:${kode}`;
}

export interface SelNilaiAset {
  nilai: number;
  massal: boolean;
}

export type PetaNilaiAset = Record<string, SelNilaiAset>;

/**
 * Penyaring status pengisian.
 *
 * Wajib ada begitu daftarnya panjang: pada D.I. dengan 987 ruas saluran,
 * pertanyaan yang paling sering muncul bukan "mana bangunan X" melainkan
 * "mana yang belum saya kerjakan". Tanpa penyaring ini jawabannya cuma bisa
 * didapat dengan menyisir 25 halaman satu per satu.
 */
const SARINGAN = [
  { kunci: "semua", label: "Semua" },
  { kunci: "belum", label: "Belum" },
  { kunci: "sebagian", label: "Sebagian" },
  { kunci: "selesai", label: "Selesai" },
] as const;

type KunciSaringan = (typeof SARINGAN)[number]["kunci"];

export interface PanelPerBangunanProps {
  aset: KelompokAset[];
  nilaiAset: PetaNilaiAset;
  kantongLumpur: KantongLumpur;
  /** Nama D.I. yang sedang dinilai, untuk memergoki aset yang salah tautan. */
  namaDi: string;
  terkunci: boolean;
  /**
   * Jenis yang sedang dibuka. Dikendalikan induk supaya kartu penunjuk di tab
   * Prasarana Fisik bisa melompat langsung ke jenis yang bersangkutan, tanpa
   * perlu menyelaraskan dua sumber kebenaran lewat effect.
   */
  jenis: JenisAset | null;
  onGantiJenis: (jenis: JenisAset) => void;
  onUbah: (asetId: number, kode: string, nilai: number | null) => void;
  /** Menyalin seluruh nilai satu bangunan ke semua bangunan sejenis. */
  onSalinKeSemua: (jenis: JenisAset, dariAsetId: number) => void;
}

export function PanelPerBangunan({
  aset,
  nilaiAset,
  kantongLumpur,
  namaDi,
  terkunci,
  jenis: jenisDiminta,
  onGantiJenis,
  onUbah,
  onSalinKeSemua,
}: PanelPerBangunanProps) {
  // Hanya jenis yang memang punya indikator per unit, terurut seperti di
  // halaman Aset supaya penilai tidak perlu belajar urutan baru.
  const kelompokDinilai = useMemo(
    () =>
      [...aset]
        .filter((k) => dinilaiPerUnit(k.jenis) && k.daftar.length > 0)
        .sort((a, b) => urutanJenis(a.jenis) - urutanJenis(b.jenis)),
    [aset],
  );

  const jenis = jenisDiminta ?? kelompokDinilai[0]?.jenis ?? null;

  const [dipilih, setDipilih] = useState<number | null>(null);

  /**
   * Awal kartu isian, untuk digulir otomatis saat bangunan dipilih.
   *
   * Daftar bangunan bisa memenuhi satu layar penuh, sehingga kartu isiannya
   * lahir di bawah lipatan. Tanpa gulir otomatis, mengklik sebuah bangunan
   * terasa seperti tidak terjadi apa-apa.
   */
  const awalForm = useRef<HTMLDivElement>(null);

  const pilihBangunan = useCallback((id: number | null) => {
    setDipilih(id);
    if (id === null) return;
    // Menunggu satu frame supaya kartunya sudah terpasang saat digulir.
    requestAnimationFrame(() => awalForm.current?.scrollIntoView({ block: "start" }));
  }, []);

  /**
   * Pencarian, penyaring, dan halaman disimpan bersama jenis pemiliknya.
   *
   * Dengan begitu ketiganya kembali ke awal saat jenis berganti, termasuk saat
   * pergantian datang dari kartu penunjuk, tanpa perlu effect penyelaras yang
   * memicu render berantai.
   */
  const [saring, setSaring] = useState<{
    jenis: JenisAset | null;
    cari: string;
    status: KunciSaringan;
    halaman: number;
  }>({ jenis, cari: "", status: "semua", halaman: 0 });

  const seJenis = saring.jenis === jenis;
  const cari = seJenis ? saring.cari : "";
  const status = seJenis ? saring.status : "semua";
  const halaman = seJenis ? saring.halaman : 0;

  const ubahSaring = (patch: Partial<typeof saring>) =>
    setSaring({ jenis, cari, status, halaman: 0, ...patch });

  const daftarJenis = useMemo(
    () => kelompokDinilai.find((k) => k.jenis === jenis)?.daftar ?? [],
    [kelompokDinilai, jenis],
  );

  const indikatorJenis = useMemo(
    () => (jenis ? kelompokUntukAset(jenis, kantongLumpur) : []),
    [jenis, kantongLumpur],
  );

  const perluPerBangunan = useMemo(
    () => indikatorJenis.reduce((a, k) => a + k.daun.length, 0),
    [indikatorJenis],
  );

  /**
   * Kelengkapan tiap bangunan dan tiap jenis, dihitung sekali per perubahan.
   *
   * Menghitungnya di dalam perulangan render akan membangun ulang daftar
   * indikator untuk tiap bangunan, dan satu D.I. punya sampai 987 ruas saluran.
   */
  const kelengkapan = useMemo(() => {
    const perAset = new Map<number, number>();
    const perJenis = new Map<JenisAset, { selesai: number; sebagian: number; total: number }>();

    for (const k of kelompokDinilai) {
      const daun = kelompokUntukAset(k.jenis, kantongLumpur).flatMap((x) => x.daun);
      const ringkas = { selesai: 0, sebagian: 0, total: k.daftar.length };

      for (const a of k.daftar) {
        let n = 0;
        for (const d of daun) if (nilaiAset[kunciSel(a.id, d.kode)]) n += 1;
        perAset.set(a.id, n);
        if (daun.length > 0 && n >= daun.length) ringkas.selesai += 1;
        else if (n > 0) ringkas.sebagian += 1;
      }
      perJenis.set(k.jenis, ringkas);
    }

    return { perAset, perJenis };
  }, [kelompokDinilai, nilaiAset, kantongLumpur]);

  const terisiUntuk = (asetId: number) => kelengkapan.perAset.get(asetId) ?? 0;
  const ringkasan = jenis
    ? (kelengkapan.perJenis.get(jenis) ?? { selesai: 0, sebagian: 0, total: 0 })
    : { selesai: 0, sebagian: 0, total: 0 };
  const belum = ringkasan.total - ringkasan.selesai - ringkasan.sebagian;

  /**
   * Penanda bagi bangunan yang nomenklaturnya dipakai bersama.
   *
   * Dihitung atas seluruh daftar jenis ini, bukan atas hasil pencarian: kalau
   * dihitung dari hasil saring, penomorannya berubah-ubah mengikuti kata kunci
   * dan justru menyesatkan.
   */
  const kembar = useMemo(() => penandaKembar(daftarJenis), [daftarJenis]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return daftarJenis.filter((a) => {
      if (status !== "semua") {
        const n = kelengkapan.perAset.get(a.id) ?? 0;
        const selesai = perluPerBangunan > 0 && n >= perluPerBangunan;
        if (status === "selesai" && !selesai) return false;
        if (status === "sebagian" && (selesai || n === 0)) return false;
        if (status === "belum" && n > 0) return false;
      }
      if (!q) return true;
      // Pencarian menjangkau seluruh keping identitas, termasuk nomor aset asli:
      // petugas yang memegang buku cetak mencari lewat nomor itu, bukan nama.
      return [
        a.nomenklatur,
        a.nama,
        a.kode,
        a.desa,
        a.kecamatan,
        a.bangunan_hulu,
        a.bangunan_hilir,
      ].some((nilai) => nilai?.toLowerCase().includes(q));
    });
  }, [daftarJenis, cari, status, kelengkapan, perluPerBangunan]);

  const jmlHalaman = Math.max(1, Math.ceil(tersaring.length / PER_HALAMAN));
  const halamanAman = Math.min(halaman, jmlHalaman - 1);
  const terlihat = tersaring.slice(
    halamanAman * PER_HALAMAN,
    halamanAman * PER_HALAMAN + PER_HALAMAN,
  );

  const asetDipilih = daftarJenis.find((a) => a.id === dipilih) ?? null;
  const indeksDipilih = tersaring.findIndex((a) => a.id === dipilih);
  const kembarDipilih = asetDipilih ? kembar.get(asetDipilih.id) : undefined;
  const terisiDipilih = asetDipilih ? terisiUntuk(asetDipilih.id) : 0;

  function pindah(arah: -1 | 1) {
    const i = indeksDipilih + arah;
    if (i < 0 || i >= tersaring.length) return;
    setDipilih(tersaring[i].id);
    setSaring({ jenis, cari, status, halaman: Math.floor(i / PER_HALAMAN) });
    awalForm.current?.scrollIntoView({ block: "start" });
  }

  const adaSebelum = indeksDipilih > 0;
  const adaSesudah = indeksDipilih >= 0 && indeksDipilih < tersaring.length - 1;

  /**
   * Berapa bangunan yang benar-benar akan berubah kalau nilai disalin.
   *
   * Bukan sekadar "semua bangunan lain": pengisian massal tidak menimpa
   * bangunan yang sudah diperiksa satu per satu. Menyebut angka yang terlalu
   * besar membuat tombolnya terasa lebih berbahaya daripada kenyataannya, dan
   * penilai jadi ragu memakai jalan pintas yang justru dirancang untuknya.
   */
  const sasaranSalin = useMemo(() => {
    if (!asetDipilih) return 0;
    const kode = indikatorJenis.flatMap((k) => k.daun.map((d) => d.kode));
    const terisiSumber = kode.filter((k) => nilaiAset[kunciSel(asetDipilih.id, k)]);
    if (terisiSumber.length === 0) return 0;

    let n = 0;
    for (const a of daftarJenis) {
      if (a.id === asetDipilih.id) continue;
      const berubah = terisiSumber.some((k) => {
        const sel = nilaiAset[kunciSel(a.id, k)];
        return !sel || sel.massal;
      });
      if (berubah) n += 1;
    }
    return n;
  }, [asetDipilih, daftarJenis, indikatorJenis, nilaiAset]);

  /** Tombol pindah bangunan, dipakai di kepala dan di kaki kartu isian. */
  const tombolPindah = (
    <>
      <Tombol varian="garis" ukuran="sm" disabled={!adaSebelum} onClick={() => pindah(-1)}>
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        Sebelumnya
      </Tombol>
      <Tombol varian="garis" ukuran="sm" disabled={!adaSesudah} onClick={() => pindah(1)}>
        Berikutnya
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Tombol>
    </>
  );

  if (kelompokDinilai.length === 0) {
    return (
      <Kartu>
        <KartuIsi>
          <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-3.5 py-3 text-xs text-slate-600">
            <Info className="mt-px h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span>
              D.I. ini belum punya aset bangunan yang terdaftar, jadi tidak ada yang bisa
              dinilai per bangunan. Lengkapi registernya lewat menu <strong>Aset Irigasi</strong>,
              atau isi indikator Prasarana Fisik secara agregat seperti biasa.
            </span>
          </div>
        </KartuIsi>
      </Kartu>
    );
  }

  return (
    <div className="space-y-4">
      {/* =============================================== daftar bangunan

          Pemilih jenis, penyaring, dan daftarnya disatukan dalam satu kartu.
          Sebelumnya terpisah jadi tiga kartu bertumpuk, dan itu mendorong
          kartu isian — satu-satunya tempat mengetik — jauh ke bawah lipatan. */}
      <Kartu>
        <KartuKepala className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <KartuJudul>Pilih bangunan yang dinilai</KartuJudul>
            <p className="text-xs text-slate-500">
              Tiap bangunan dinilai sendiri, lalu dirata-rata menjadi nilai indikator.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {kelompokDinilai.map((k) => {
              const aktif = k.jenis === jenis;
              const r = kelengkapan.perJenis.get(k.jenis);
              const selesai = r?.selesai ?? 0;
              const tuntas = selesai === k.daftar.length;

              return (
                <button
                  key={k.jenis}
                  type="button"
                  onClick={() => {
                    onGantiJenis(k.jenis);
                    setDipilih(null);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] transition-colors",
                    aktif
                      ? "border-brand-600 bg-brand-600 text-white"
                      : tuntas
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                  )}
                >
                  {tuntas ? (
                    <Check
                      className={cn("h-3 w-3", aktif ? "text-white" : "text-emerald-600")}
                      aria-hidden
                    />
                  ) : null}
                  {JENIS_ASET[k.jenis].label}
                  <span
                    className={cn(
                      "rounded px-1 font-mono tabular-nums",
                      aktif
                        ? "bg-white/20"
                        : tuntas
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {selesai}/{k.daftar.length}
                  </span>
                </button>
              );
            })}
          </div>
        </KartuKepala>

        {jenis ? (
          <KartuIsi className="space-y-3">
            {/* Kemajuan jenis yang sedang dibuka, sebagai satu bilah. Angka
                "12 dari 41" jauh lebih cepat ditangkap daripada tiga hitungan
                terpisah yang harus dijumlah sendiri di kepala. */}
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
                <span className="font-medium text-slate-700">
                  {JENIS_ASET[jenis].label}
                  <span className="ml-2 font-normal text-slate-500">
                    {ringkasan.selesai} dari {ringkasan.total} bangunan selesai
                  </span>
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  {perluPerBangunan} indikator per bangunan
                </span>
              </div>
              <BilahProgres
                nilai={ringkasan.selesai}
                maks={Math.max(1, ringkasan.total)}
                className="mt-1.5 h-1.5"
                warnaBilah={
                  ringkasan.selesai === ringkasan.total ? "bg-emerald-500" : "bg-brand-600"
                }
              />
            </div>

            {/* ------------------------------------------- saring & cari */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1">
                {SARINGAN.map((s) => {
                  const jml =
                    s.kunci === "semua"
                      ? ringkasan.total
                      : s.kunci === "selesai"
                        ? ringkasan.selesai
                        : s.kunci === "sebagian"
                          ? ringkasan.sebagian
                          : belum;
                  return (
                    <button
                      key={s.kunci}
                      type="button"
                      onClick={() => ubahSaring({ status: s.kunci })}
                      className={cn(
                        "rounded-md border px-2 py-1 text-[11px] transition-colors",
                        status === s.kunci
                          ? "border-slate-800 bg-slate-800 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                      )}
                    >
                      {s.label}
                      <span
                        className={cn(
                          "ml-1.5 font-mono tabular-nums",
                          status === s.kunci ? "text-white/70" : "text-slate-400",
                        )}
                      >
                        {jml}
                      </span>
                    </button>
                  );
                })}
              </div>

              {daftarJenis.length > 8 ? (
                <label className="relative min-w-0 flex-1 sm:min-w-56">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={cari}
                    onChange={(e) => ubahSaring({ cari: e.target.value })}
                    placeholder="Cari nomenklatur, nomor aset, atau desa…"
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                    aria-label="Cari bangunan"
                  />
                </label>
              ) : null}
            </div>

            {/* ------------------------------------------- daftar bangunan */}
            <ul className="scroll-halus max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {terlihat.map((a) => {
                const n = terisiUntuk(a.id);
                const tuntas = perluPerBangunan > 0 && n >= perluPerBangunan;
                const aktif = a.id === dipilih;
                const ruas = ruasAset(a);
                const letak = letakAset(a);
                const tandaKembar = kembar.get(a.id);
                const salahTaut = namaDiBerbeda(a.nama_di_buku, namaDi);

                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => pilihBangunan(aktif ? null : a.id)}
                      className={cn(
                        "flex w-full flex-col gap-1 px-3 py-2.5 text-left text-xs transition-colors",
                        aktif
                          ? "bg-brand-50 ring-1 ring-brand-300 ring-inset"
                          : "hover:bg-slate-50",
                      )}
                    >
                      {/* Baris 1: sebutan bangunan + status pengisian. */}
                      <span className="flex w-full items-center gap-2">
                        {a.nomenklatur ? (
                          <code className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-brand-700">
                            {a.nomenklatur}
                          </code>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-700">
                          {a.nama}
                        </span>
                        <span className="shrink-0">
                          {tuntas ? (
                            <Lencana nada="hijau">Selesai</Lencana>
                          ) : n > 0 ? (
                            <Lencana nada="kuning">
                              {n}/{perluPerBangunan}
                            </Lencana>
                          ) : (
                            <Lencana nada="netral">Belum</Lencana>
                          )}
                        </span>
                      </span>

                      {/* Baris 2: letak dan ruas. Dibungkus supaya di layar
                          sempit turun ke bawah, bukan mendorong lencana status
                          keluar tepi layar seperti sebelumnya. */}
                      <span className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                        <span className="flex min-w-0 items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                          <span className={cn("truncate", !letak && "text-amber-700 italic")}>
                            {letak ?? "letak belum dicatat"}
                          </span>
                        </span>
                        {ruas ? <span className="min-w-0 truncate">{ruas}</span> : null}
                        {/*
                          Panjang ruas, khusus saluran. Ditaruh di daftar, bukan
                          hanya di rincian bangunan terpilih, karena di sinilah
                          petugas memilih ruas: seluruh saluran bernama serupa,
                          dan panjang sering jadi satu-satunya pembeda yang bisa
                          dicocokkan dengan keadaan lapangan tanpa membuka
                          bangunannya satu per satu.
                        */}
                        {jenis === "saluran" && a.panjang !== null ? (
                          <span className="shrink-0 font-medium tabular-nums text-slate-600">
                            {formatPanjang(a.panjang)}
                          </span>
                        ) : null}
                      </span>

                      {/* Baris 3: nomor aset asli dan peringatan. Nomor aset
                          diberi ruang sendiri karena sejak nomor buku dipakai,
                          dialah yang dicocokkan petugas dengan berkas cetak. */}
                      <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
                        {a.kode ? (
                          <span className="font-mono text-[11px] tracking-tight text-slate-500">
                            {a.kode}
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-700 italic">
                            nomor aset belum ada
                          </span>
                        )}
                        {tandaKembar ? (
                          <span
                            className="rounded bg-amber-50 px-1 py-px text-[10px] font-medium text-amber-700"
                            title={
                              tandaKembar.takTerbedakan
                                ? "Seluruh datanya sama persis dengan bangunan lain di D.I. ini, nomor asetnya pun. Tidak ada yang bisa membedakannya."
                                : "Nomenklatur ini dipakai beberapa bangunan di D.I. ini. Bedakan lewat nomor asetnya."
                            }
                          >
                            {tandaKembar.takTerbedakan ? "tak terbedakan" : "nomenklatur kembar"} ·{" "}
                            {tandaKembar.urutan}/{tandaKembar.total}
                          </span>
                        ) : null}
                        {salahTaut ? (
                          <span
                            className="rounded bg-amber-50 px-1 py-px text-[10px] font-medium text-amber-700"
                            title={`Di buku tertulis "${a.nama_di_buku}", bukan ${namaDi}.`}
                          >
                            di buku: {a.nama_di_buku}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
              {terlihat.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-slate-500">
                  {status === "selesai"
                    ? "Belum ada bangunan yang selesai dinilai."
                    : status === "belum"
                      ? "Semua bangunan jenis ini sudah mulai dinilai."
                      : status === "sebagian"
                        ? "Tidak ada bangunan yang baru terisi sebagian."
                        : "Tidak ada bangunan yang cocok dengan pencarian."}
                </li>
              ) : null}
            </ul>

            {jmlHalaman > 1 ? (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {halamanAman * PER_HALAMAN + 1}–
                  {Math.min((halamanAman + 1) * PER_HALAMAN, tersaring.length)} dari{" "}
                  {tersaring.length}
                </span>
                <span className="flex items-center gap-1.5">
                  <Tombol
                    varian="garis"
                    ukuran="sm"
                    disabled={halamanAman === 0}
                    onClick={() => setSaring({ jenis, cari, status, halaman: halamanAman - 1 })}
                    aria-label="Halaman sebelumnya"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                  </Tombol>
                  <span className="font-mono tabular-nums">
                    {halamanAman + 1}/{jmlHalaman}
                  </span>
                  <Tombol
                    varian="garis"
                    ukuran="sm"
                    disabled={halamanAman >= jmlHalaman - 1}
                    onClick={() => setSaring({ jenis, cari, status, halaman: halamanAman + 1 })}
                    aria-label="Halaman berikutnya"
                  >
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </Tombol>
                </span>
              </div>
            ) : null}
          </KartuIsi>
        ) : null}
      </Kartu>

      {/* ======================================== form bangunan terpilih

          `--bilah-tab` diisi form penilaian: tinggi bilah tab yang menempel di
          puncak, yang membungkus jadi satu sampai tiga baris tergantung lebar
          layar. Dipakai dua kali di sini, sebagai jarak berhenti gulir dan
          sebagai posisi kepala kartu, supaya keduanya tidak saling tumpang
          tindih pada lebar layar mana pun. */}
      <div
        ref={awalForm}
        style={{ scrollMarginTop: "calc(var(--bilah-tab, 3.5rem) + 0.5rem)" }}
      />

      {asetDipilih && jenis ? (
        <Kartu>
          {/* Kepala kartu menempel saat digulir. Satu bendung berisi 33 kartu
              indikator dan panjangnya ribuan piksel; tanpa ini penilai
              kehilangan jejak bangunan mana yang sedang ia isi, dan harus
              menggulir balik ke puncak hanya untuk pindah ke bangunan
              berikutnya. */}
          <KartuKepala
            className="sticky z-10 rounded-t-xl bg-white/95 backdrop-blur"
            style={{ top: "var(--bilah-tab, 3.5rem)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="min-w-0">
                <KartuJudul className="truncate">{sebutanAset(asetDipilih)}</KartuJudul>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {letakAset(asetDipilih) ?? "letak belum dicatat"}
                  {indeksDipilih >= 0
                    ? ` · bangunan ${indeksDipilih + 1} dari ${tersaring.length}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums",
                    terisiDipilih >= perluPerBangunan
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600",
                  )}
                >
                  {terisiDipilih}/{perluPerBangunan}
                </span>
                {tombolPindah}
              </div>
            </div>
            <BilahProgres
              nilai={terisiDipilih}
              maks={Math.max(1, perluPerBangunan)}
              className="mt-2 h-1"
              warnaBilah={
                terisiDipilih >= perluPerBangunan ? "bg-emerald-500" : "bg-brand-600"
              }
            />
          </KartuKepala>

          <KartuIsi className="space-y-5">
            {/* --------------------------------------- identitas bangunan

                Dipasang tepat di atas kartu indikator, bukan disembunyikan di
                balik tooltip: penilai perlu memastikan bangunan di layar
                memang bangunan yang sedang ia periksa SEBELUM mengisi nilai,
                bukan sesudah. Nomor aset yang ditampilkan adalah nomor asli
                dari buku, sama persis dengan berkas cetak yang dipegang. */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-3 sm:grid-cols-3">
              {rincianAset(asetDipilih, jenis).map((r) => (
                <div key={r.label} className="min-w-0">
                  <dt className="text-[10px] tracking-wide text-slate-500 uppercase">{r.label}</dt>
                  <dd
                    className={cn(
                      "truncate text-xs",
                      r.kosong ? "text-amber-700 italic" : "text-slate-700",
                      r.label === "Nomor aset" && !r.kosong ? "font-mono" : "",
                    )}
                    title={r.nilai}
                  >
                    {r.nilai}
                  </dd>
                </div>
              ))}
              {kembarDipilih ? (
                <div className="col-span-full flex items-start gap-2 text-[11px] leading-relaxed text-amber-700">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                  {kembarDipilih.takTerbedakan ? (
                    <span>
                      Ada {kembarDipilih.total} bangunan di D.I. ini yang seluruh datanya sama
                      persis, nomor asetnya pun, dan ini yang ke-{kembarDipilih.urutan}. Tidak ada
                      yang bisa membedakannya. Lengkapi dulu pembedanya lewat menu{" "}
                      <strong>Aset Irigasi</strong> sebelum hasil penilaian ini dipakai.
                    </span>
                  ) : (
                    <span>
                      Nomenklatur ini dipakai {kembarDipilih.total} bangunan di D.I. ini, dan ini
                      yang ke-{kembarDipilih.urutan}. Pastikan nomor asetnya cocok dengan yang Anda
                      periksa di lapangan.
                    </span>
                  )}
                </div>
              ) : null}
              {namaDiBerbeda(asetDipilih.nama_di_buku, namaDi) ? (
                <div className="col-span-full flex items-start gap-2 text-[11px] leading-relaxed text-amber-700">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    Di Buku Aset bangunan ini tertulis milik{" "}
                    <strong>{asetDipilih.nama_di_buku}</strong>, bukan D.I. {namaDi}. Penautannya
                    dibuat dari kode pada nomor aset, jadi kemungkinan kodenya keliru. Periksa dulu
                    sebelum dinilai.
                  </span>
                </div>
              ) : null}
            </dl>

            {indikatorJenis.map((kel) => {
              const terisiKel = kel.daun.filter(
                (n) => nilaiAset[kunciSel(asetDipilih.id, n.kode)],
              ).length;

              return (
                <section key={kel.kode}>
                  {/* Kemajuan per kelompok. Pada bendung ada empat kelompok
                      berturut-turut; tanpa hitungan ini penilai tidak tahu
                      kelompok mana yang masih bolong tanpa menyisirnya lagi. */}
                  <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-200 pb-2">
                    <h3 className="text-sm font-semibold text-slate-900">{kel.label}</h3>
                    <span
                      className={cn(
                        "font-mono text-[11px] tabular-nums",
                        terisiKel === kel.daun.length ? "text-emerald-600" : "text-slate-400",
                      )}
                    >
                      {terisiKel}/{kel.daun.length} terisi
                    </span>
                  </header>
                  <div className="space-y-3">
                    {kel.daun.map((node) => {
                      const sel = nilaiAset[kunciSel(asetDipilih.id, node.kode)];
                      return (
                        <KartuIndikator
                          key={node.kode}
                          node={node}
                          bobot={bobotEfektif(node, kantongLumpur)}
                          nilai={sel?.nilai ?? null}
                          keterangan=""
                          terkunci={terkunci}
                          onUbah={(v) => onUbah(asetDipilih.id, node.kode, v)}
                          onUbahKeterangan={() => {}}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {/* Pengisian massal. Tanpa ini, D.I. dengan 987 ruas saluran tidak
                akan pernah selesai diisi dan datanya akan diisi asal. */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3.5 py-3">
              <p className="min-w-0 text-xs leading-relaxed text-slate-600">
                Bangunan lain sejenis kondisinya sama?{" "}
                <span className="text-slate-500">
                  {terisiDipilih === 0
                    ? "Isi dulu bangunan ini, lalu nilainya bisa disalin sekaligus."
                    : sasaranSalin === 0
                      ? "Semua bangunan sejenis sudah Anda periksa sendiri, jadi tidak ada yang perlu disalin."
                      : `Nilai bangunan ini disalin ke ${sasaranSalin} bangunan lain yang belum diperiksa satu per satu, dan ditandai sebagai pengisian massal. Yang sudah Anda periksa sendiri tidak ikut tertimpa.`}
                </span>
              </p>
              <Tombol
                varian="garis"
                ukuran="sm"
                disabled={terkunci || terisiDipilih === 0 || sasaranSalin === 0}
                onClick={() => onSalinKeSemua(jenis, asetDipilih.id)}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                {/* Angkanya baru disebut kalau memang ada yang akan berubah.
                    "Salin ke 0 saluran lain" membuat tombol mati terbaca
                    seperti tombol rusak. */}
                {sasaranSalin > 0
                  ? `Salin ke ${sasaranSalin} ${JENIS_ASET[jenis].singkat.toLowerCase()} lain`
                  : `Salin ke ${JENIS_ASET[jenis].singkat.toLowerCase()} lain`}
              </Tombol>
            </div>

            {/* Pindah bangunan diulang di kaki kartu: kartu indikator terakhir
                jaraknya ribuan piksel dari kepala, dan memaksa penilai
                menggulir balik ke puncak tiap selesai satu bangunan adalah
                beban yang tidak perlu. */}
            {adaSebelum || adaSesudah ? (
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <span className="text-xs text-slate-500">
                  Bangunan {indeksDipilih + 1} dari {tersaring.length}
                </span>
                <span className="flex gap-1.5">{tombolPindah}</span>
              </div>
            ) : null}
          </KartuIsi>
        </Kartu>
      ) : jenis ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-xs text-slate-500">
          Pilih salah satu bangunan di atas untuk mulai menilainya.
        </p>
      ) : null}
    </div>
  );
}
