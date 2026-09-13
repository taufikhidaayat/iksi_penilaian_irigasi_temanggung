"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { BilahProgres, Kartu, KartuIsi, KartuJudul, KartuKepala, Lencana, Pilihan, Tombol } from "@/components/ui";
import { useKonfirmasi } from "@/components/ui/konfirmasi";
import { useToast } from "@/components/ui/toast";
import {
  ANAK_BY_PARENT,
  INDIKATOR_INPUT,
  INFO_KATEGORI_IKSI,
  KOMPONEN_UTAMA,
  NODE_BY_KODE,
  hitungSkor,
  isRelevan,
  kategoriIksi,
} from "@/lib/iksi/scoring";
import type { KantongLumpur, NilaiInput } from "@/lib/iksi/types";
import type { ArealTerdampak, DaerahIrigasi, JenisAset, Penilaian } from "@/lib/supabase/types";
import { INFO_STATUS, nadaKategori } from "@/lib/tampilan";
import { cn, formatAngka } from "@/lib/utils";

import { PanelAreal, type NilaiAreal } from "./panel-areal";
import { PanelAsetDi, type KelompokAset } from "./panel-aset-di";
import { PohonIndikator } from "./pohon-indikator";

type Simpanan = { ok: boolean; pesan?: string };

/** Urutan perpindahan tab: lima komponen IKSI, lalu areal terdampak. */
const URUTAN_TAB: string[] = [...KOMPONEN_UTAMA.map((k) => k.kode), "areal"];

function labelTab(kode: string): string {
  if (kode === "areal") return "Areal Terdampak";
  const node = NODE_BY_KODE.get(kode);
  return node ? `${node.nomor}. ${node.label}` : kode;
}

export interface FormPenilaianProps {
  penilaian: Penilaian;
  di: DaerahIrigasi;
  namaUpt: string;
  nilaiAwal: NilaiInput;
  keteranganAwal: Record<string, string>;
  arealAwal: ArealTerdampak | null;
  bisaEdit: boolean;
  /** Menampilkan tombol verifikasi saat penilaian berstatus "diajukan". */
  isAdmin: boolean;
  /** Aset terdaftar pada D.I. ini, sebagai konteks saat menilai. */
  aset: KelompokAset[];
  onSimpan: (muatan: {
    id: string;
    kantongLumpur: KantongLumpur;
    jumlahP3a: number | null;
    jumlahGp3a: number | null;
    catatan: string | null;
    nilai: Record<string, number | null>;
    keterangan: Record<string, string>;
    areal: NilaiAreal | null;
  }) => Promise<Simpanan>;
  onAjukan: () => Promise<Simpanan>;
  onSetujui: () => Promise<Simpanan>;
  onRevisi: () => Promise<Simpanan>;
  /** Menghapus penilaian ini dan langsung menggantinya dengan draf kosong baru. */
  onUlangi: () => Promise<Simpanan & { id?: string }>;
  /** Menghapus penilaian ini tanpa menggantinya — hilang begitu saja dari daftar. */
  onHapus: () => Promise<Simpanan>;
}

const AREAL_KOSONG: NilaiAreal = {
  bangunan_utama: 0,
  saluran_pembawa: 0,
  bangunan_saluran_pembawa: 0,
  saluran_pembuang: 0,
  jalan_inspeksi: 0,
  kantor_perumahan_gudang: 0,
};

/**
 * Jenis aset yang paling berkaitan dengan tiap komponen IKSI.
 * Dipakai untuk menyorot tab aset yang relevan, bukan menyaring.
 */
const ASET_RELEVAN: Record<string, JenisAset[]> = {
  I: ["bendung", "saluran", "sadap", "saluran_pelimpah", "gorong_gorong", "talang", "terjunan"],
};

/** Daun relevan di bawah sebuah komponen. */
function daunRelevan(kodeAkar: string, kl: KantongLumpur): string[] {
  const hasil: string[] = [];
  const turun = (kode: string) => {
    const node = NODE_BY_KODE.get(kode);
    if (!node || !isRelevan(node, kl)) return;
    if (node.agregasi === "leaf") hasil.push(kode);
    else for (const a of ANAK_BY_PARENT.get(kode) ?? []) turun(a);
  };
  turun(kodeAkar);
  return hasil;
}

export function FormPenilaian(props: FormPenilaianProps) {
  const { penilaian, di, namaUpt, bisaEdit, isAdmin } = props;
  const router = useRouter();

  // Sama seperti kebijakan RLS "hapus penilaian" di database: admin bebas,
  // UPT hanya boleh mengulang/menghapus selama masih draft (belum pernah diajukan).
  // Menggerbangi tombol "Ulangi" maupun "Hapus" — keduanya sama-sama bertumpu
  // pada kebijakan hapus itu ("ulangi" cuma hapus lalu langsung buat draf baru).
  const bisaHapus = isAdmin || penilaian.status === "draft";

  const [nilai, setNilai] = useState<NilaiInput>(props.nilaiAwal);
  const [keterangan, setKeterangan] = useState<Record<string, string>>(props.keteranganAwal);
  const [kantongLumpur, setKantongLumpur] = useState<KantongLumpur>(penilaian.kantong_lumpur);
  const [jumlahP3a, setJumlahP3a] = useState<string>(penilaian.jumlah_p3a?.toString() ?? "");
  const [jumlahGp3a, setJumlahGp3a] = useState<string>(penilaian.jumlah_gp3a?.toString() ?? "");
  const [areal, setAreal] = useState<NilaiAreal>(() =>
    props.arealAwal
      ? {
          bangunan_utama: Number(props.arealAwal.bangunan_utama),
          saluran_pembawa: Number(props.arealAwal.saluran_pembawa),
          bangunan_saluran_pembawa: Number(props.arealAwal.bangunan_saluran_pembawa),
          saluran_pembuang: Number(props.arealAwal.saluran_pembuang),
          jalan_inspeksi: Number(props.arealAwal.jalan_inspeksi),
          kantor_perumahan_gudang: Number(props.arealAwal.kantor_perumahan_gudang),
        }
      : AREAL_KOSONG,
  );

  const toast = useToast();
  const konfirmasi = useKonfirmasi();

  const [tab, setTab] = useState<string>(KOMPONEN_UTAMA[0].kode);
  const [menyimpan, setMenyimpan] = useState(false);
  const [mengulangi, setMengulangi] = useState(false);
  const [menghapus, setMenghapus] = useState(false);
  const [pesan, setPesan] = useState<{ jenis: "ok" | "galat"; teks: string } | null>(null);
  const [kotor, setKotor] = useState(false);

  const skor = useMemo(() => hitungSkor(nilai, kantongLumpur), [nilai, kantongLumpur]);
  const kategori = kategoriIksi(skor.total);

  const progresKomponen = useMemo(
    () =>
      KOMPONEN_UTAMA.map((k) => {
        const daun = daunRelevan(k.kode, kantongLumpur);
        const terisi = daun.filter((d) => nilai[d] !== null && nilai[d] !== undefined).length;
        return { kode: k.kode, nomor: k.nomor, label: k.label, total: daun.length, terisi };
      }),
    [nilai, kantongLumpur],
  );

  /* ----------------------------------------------------- perpindahan tab */

  // Panel isian bisa sangat panjang — komponen I saja 108 sub-indikator — jadi
  // perpindahan komponen tidak boleh bergantung pada bilah tab di puncak
  // halaman saja. Setiap ganti tab, tampilan dikembalikan ke awal panel.
  const awalTab = useRef<HTMLDivElement>(null);

  const gantiTab = useCallback((kode: string) => {
    setTab(kode);
    awalTab.current?.scrollIntoView({ block: "start" });
  }, []);

  const indeksTab = URUTAN_TAB.indexOf(tab);
  const tabSebelum = indeksTab > 0 ? URUTAN_TAB[indeksTab - 1] : null;
  const tabSesudah = indeksTab < URUTAN_TAB.length - 1 ? URUTAN_TAB[indeksTab + 1] : null;

  /* ---------------------------------------------------------- simpan */

  // Simpan rujukan terbaru ke aksi server tanpa membuat `kirim` berganti
  // identitas tiap render — kalau berganti, timer autosave akan terus di-reset
  // dan penyimpanan otomatis tidak pernah jalan.
  const simpanRef = useRef(props.onSimpan);
  useEffect(() => {
    simpanRef.current = props.onSimpan;
  }, [props.onSimpan]);

  const kirim = useCallback(async (diamDiam = false): Promise<Simpanan> => {
    setMenyimpan(true);
    const hasil = await simpanRef.current({
      id: penilaian.id,
      kantongLumpur,
      jumlahP3a: jumlahP3a === "" ? null : Number(jumlahP3a),
      jumlahGp3a: jumlahGp3a === "" ? null : Number(jumlahGp3a),
      catatan: penilaian.catatan,
      nilai: nilai as Record<string, number | null>,
      keterangan,
      areal,
    });
    setMenyimpan(false);
    if (hasil.ok) {
      setKotor(false);
      setPesan({ jenis: "ok", teks: "Tersimpan" });
      // Autosave cukup ditandai indikator kecil; toast hanya untuk aksi yang
      // memang ditekan pengguna, supaya tidak muncul terus-menerus saat mengisi.
      if (!diamDiam) toast.sukses("Penilaian tersimpan", "Draft diperbarui.");
    } else {
      setPesan({ jenis: "galat", teks: hasil.pesan ?? "Gagal menyimpan" });
      // Kegagalan selalu disuarakan — termasuk saat autosave, karena kalau
      // diam pengguna bisa terus mengisi padahal tidak ada yang tersimpan.
      toast.galat("Gagal menyimpan", hasil.pesan ?? "Periksa koneksi lalu coba lagi.");
    }
    return hasil;
  }, [penilaian.id, penilaian.catatan, kantongLumpur, jumlahP3a, jumlahGp3a, nilai, keterangan, areal, toast]);

  // Simpan otomatis 2 detik setelah perubahan terakhir berhenti.
  useEffect(() => {
    if (!kotor || !bisaEdit) return;
    const t = setTimeout(() => void kirim(true), 2000);
    return () => clearTimeout(t);
  }, [kotor, bisaEdit, kirim]);

  // Cegah menutup tab saat masih ada perubahan yang belum tersimpan.
  useEffect(() => {
    if (!kotor) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [kotor]);

  useEffect(() => {
    if (!pesan) return;
    const t = setTimeout(() => setPesan(null), 3000);
    return () => clearTimeout(t);
  }, [pesan]);

  const ubahNilai = useCallback((kode: string, v: number | null) => {
    setNilai((s) => ({ ...s, [kode]: v }));
    setKotor(true);
  }, []);

  const ubahKeterangan = useCallback((kode: string, teks: string) => {
    setKeterangan((s) => ({ ...s, [kode]: teks }));
    setKotor(true);
  }, []);

  async function ajukan() {
    const setuju = await konfirmasi({
      judul: "Ajukan penilaian ini?",
      pesan: `${di.nama} — ${penilaian.triwulan} ${penilaian.tahun}. Nilai IKSI ${formatAngka(skor.total, 2)} (${INFO_KATEGORI_IKSI[kategori].label}).`,
      catatan:
        "Setelah diajukan, penilaian terkunci dan hanya bisa diubah lagi bila Administrator mengembalikannya untuk revisi.",
      tombolYa: "Ya, ajukan",
      nada: "peringatan",
    });
    if (!setuju) return;

    const disimpan = await kirim(true);
    if (!disimpan.ok) return;

    setMenyimpan(true);
    const hasil = await props.onAjukan();
    setMenyimpan(false);
    if (hasil.ok) {
      setPesan({ jenis: "ok", teks: "Penilaian berhasil diajukan." });
      toast.sukses("Penilaian diajukan", "Menunggu verifikasi Administrator.");
    } else {
      setPesan({ jenis: "galat", teks: hasil.pesan ?? "Gagal mengajukan." });
      toast.galat("Gagal mengajukan", hasil.pesan);
    }
  }

  async function setujui() {
    const setuju = await konfirmasi({
      judul: "Setujui penilaian ini?",
      pesan: `${di.nama} — nilai IKSI ${formatAngka(skor.total, 2)} (${INFO_KATEGORI_IKSI[kategori].label}).`,
      catatan: "Setelah disetujui, penilaian masuk rekapitulasi dan ikut terekspor.",
      tombolYa: "Ya, setujui",
      nada: "biasa",
    });
    if (!setuju) return;

    setMenyimpan(true);
    const hasil = await props.onSetujui();
    setMenyimpan(false);
    if (hasil.ok) toast.sukses("Penilaian disetujui", `${di.nama} masuk rekapitulasi.`);
    else toast.galat("Gagal menyetujui", hasil.pesan);
  }

  async function kembalikan() {
    const setuju = await konfirmasi({
      judul: "Kembalikan untuk revisi?",
      pesan: `${di.nama} akan dibuka kembali agar UPT bisa memperbaiki isiannya.`,
      catatan: "Penilaian keluar dari rekapitulasi sampai diajukan dan disetujui lagi.",
      tombolYa: "Ya, kembalikan",
      nada: "peringatan",
    });
    if (!setuju) return;

    setMenyimpan(true);
    const hasil = await props.onRevisi();
    setMenyimpan(false);
    if (hasil.ok) toast.info("Dikembalikan untuk revisi", `${di.nama} bisa diperbaiki UPT.`);
    else toast.galat("Gagal mengembalikan", hasil.pesan);
  }

  async function ulangi() {
    const setuju = await konfirmasi({
      judul: "Ulangi penilaian ini dari awal?",
      pesan: `Seluruh isian ${di.nama} — ${penilaian.triwulan} ${penilaian.tahun} akan dikosongkan lagi, termasuk nilai indikator yang sudah diisi.`,
      catatan: "Tindakan ini tidak bisa dibatalkan. Anda akan langsung diarahkan ke draf baru yang kosong.",
      tombolYa: "Ya, ulangi",
      nada: "peringatan",
    });
    if (!setuju) return;

    setMengulangi(true);
    const hasil = await props.onUlangi();
    if (hasil.ok && hasil.id) {
      toast.sukses("Penilaian diulang", `${di.nama} siap diisi dari awal.`);
      router.push(`/penilaian/${hasil.id}`);
      router.refresh();
    } else {
      setMengulangi(false);
      toast.galat("Gagal mengulang", hasil.pesan);
    }
  }

  async function hapus() {
    const setuju = await konfirmasi({
      judul: "Hapus penilaian ini?",
      pesan: `${di.nama} — ${penilaian.triwulan} ${penilaian.tahun} akan dihapus permanen, termasuk seluruh nilai indikator yang sudah diisi.`,
      catatan: "Tindakan ini tidak bisa dibatalkan. Penilaian hilang dari daftar dan tidak digantikan draf baru.",
      tombolYa: "Ya, hapus",
      nada: "bahaya",
    });
    if (!setuju) return;

    setMenghapus(true);
    const hasil = await props.onHapus();
    if (hasil.ok) {
      toast.sukses("Penilaian dihapus", `${di.nama} sudah dihapus.`);
      router.push("/penilaian");
      router.refresh();
    } else {
      setMenghapus(false);
      toast.galat("Gagal menghapus", hasil.pesan);
    }
  }

  /** Mengubah kantong lumpur menggeser bobot dan mematikan sebagian indikator. */
  async function ubahKantongLumpur(baru: KantongLumpur) {
    if (baru === kantongLumpur) return;

    const hilang = INDIKATOR_INPUT.filter(
      (n) =>
        isRelevan(n, kantongLumpur) &&
        !isRelevan(n, baru) &&
        nilai[n.kode] !== null &&
        nilai[n.kode] !== undefined,
    );

    if (hilang.length > 0) {
      const setuju = await konfirmasi({
        judul: "Ubah ketersediaan kantong lumpur?",
        pesan: `${hilang.length} indikator yang sudah Anda isi akan menjadi tidak berlaku dan nilainya dihapus.`,
        catatan:
          "Bobot Bendung dan Pintu-pintu bendung juga ikut berubah, sehingga nilai Prasarana Fisik akan bergeser.",
        tombolYa: "Ya, ubah",
        nada: "peringatan",
      });
      if (!setuju) return;
    }

    setKantongLumpur(baru);
    setKotor(true);
    toast.info(
      baru === "ada" ? "Kantong lumpur: ada" : "Kantong lumpur: tidak ada",
      "Bobot indikator disesuaikan otomatis.",
    );
  }

  const info = INFO_STATUS[penilaian.status];
  const lengkap = skor.belumTerisi.length === 0;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
      <div className="min-w-0 space-y-4">
        {/* ------------------------------------------------ identitas D.I. */}
        <Kartu>
          <KartuKepala className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <KartuJudul className="truncate text-base">{di.nama}</KartuJudul>
              <p className="mt-0.5 font-mono text-xs text-slate-400">{di.kode}</p>
            </div>
            <Lencana nada={info.nada}>{info.label}</Lencana>
          </KartuKepala>
          <KartuIsi className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
            {[
              ["Kecamatan", di.kecamatan ?? "–"],
              ["Desa/Kelurahan", di.desa ?? "–"],
              ["Luas Baku", `${formatAngka(di.luas_baku, 2)} Ha`],
              ["Luas Potensial", `${formatAngka(di.luas_potensial, 2)} Ha`],
              ["Luas Fungsional", `${formatAngka(di.luas_fungsional, 2)} Ha`],
            ].map(([label, isi]) => (
              <div key={label}>
                <dt className="text-[11px] text-slate-500">{label}</dt>
                <dd className="mt-0.5 font-medium text-slate-800">{isi}</dd>
              </div>
            ))}
            <div className="col-span-2 sm:col-span-3 lg:col-span-5">
              <dt className="text-[11px] text-slate-500">UPT · Periode</dt>
              <dd className="mt-0.5 font-medium text-slate-800">
                {namaUpt} · {penilaian.triwulan} {penilaian.tahun}
              </dd>
            </div>
          </KartuIsi>
        </Kartu>

        {/* -------------------------------------------- toggle kantong lumpur */}
        <Kartu className="border-amber-200 bg-amber-50/40">
          <KartuIsi className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex min-w-0 items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  Apakah D.I. ini memiliki kantong lumpur?
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Menentukan bobot Bendung (4 atau 5), Pintu bendung (7 atau 8), dan mematikan
                  seluruh sub-indikator Kantong Lumpur. Salah pilih akan menggeser nilai
                  Prasarana Fisik.
                </p>
              </div>
            </div>
            <Pilihan
              value={kantongLumpur}
              disabled={!bisaEdit}
              onChange={(e) => void ubahKantongLumpur(e.target.value as KantongLumpur)}
              className="h-9 w-32 shrink-0 text-xs"
              aria-label="Ketersediaan kantong lumpur"
            >
              <option value="ada">Ada</option>
              <option value="tidak">Tidak ada</option>
            </Pilihan>
          </KartuIsi>
        </Kartu>

        {/* ------------------------------------------------------- tab komponen */}
        {/* Titik henti gulir saat tab berganti; diberi jarak agar tidak tertutup
            bilah header yang menempel di layar kecil. */}
        <div ref={awalTab} className="scroll-mt-16 lg:scroll-mt-4" />

        {/* Di layar sempit tab digulir mendatar; mulai lg tab dibungkus ke baris
            berikutnya supaya seluruh komponen terlihat sekaligus — tab yang
            tersembunyi di balik gulir mudah terlewat penilai. Bilahnya menempel
            saat halaman digulir supaya pindah komponen tidak perlu naik dulu. */}
        <div className="scroll-halus sticky top-14 z-20 -mx-1 overflow-x-auto bg-(--latar) px-1 py-2 lg:top-0 lg:overflow-visible">
          <div className="flex min-w-max gap-1.5 lg:min-w-0 lg:flex-wrap" role="tablist">
            {progresKomponen.map((k) => {
              const ini = tab === k.kode;
              const penuh = k.terisi === k.total && k.total > 0;
              return (
                <button
                  key={k.kode}
                  role="tab"
                  aria-selected={ini}
                  onClick={() => gantiTab(k.kode)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                    ini
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  <span className={cn("font-mono text-xs", ini ? "text-brand-200" : "text-slate-400")}>
                    {k.nomor}
                  </span>
                  <span className="max-w-36 truncate text-xs font-medium lg:max-w-none">
                    {k.label}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                      ini
                        ? "bg-white/20 text-white"
                        : penuh
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {k.terisi}/{k.total}
                  </span>
                </button>
              );
            })}
            <button
              role="tab"
              aria-selected={tab === "areal"}
              onClick={() => gantiTab("areal")}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                tab === "areal"
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              Areal Terdampak
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------ isi tab */}
        {tab === "areal" ? (
          <PanelAreal
            nilai={areal}
            luasBaku={di.luas_baku}
            terkunci={!bisaEdit}
            onUbah={(v) => {
              setAreal(v);
              setKotor(true);
            }}
          />
        ) : (
          <Kartu>
            <KartuKepala>
              <KartuJudul>
                {NODE_BY_KODE.get(tab)?.nomor}. {NODE_BY_KODE.get(tab)?.label}
              </KartuJudul>
            </KartuKepala>
            <KartuIsi className="space-y-5">
              {tab === "VI" ? (
                <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
                  {(
                    [
                      ["Jumlah P3A (buah)", jumlahP3a, setJumlahP3a],
                      ["Jumlah GP3A (buah)", jumlahGp3a, setJumlahGp3a],
                    ] as const
                  ).map(([label, nilaiInput, set]) => (
                    <label key={label} className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
                      <input
                        type="number"
                        min={0}
                        value={nilaiInput}
                        disabled={!bisaEdit}
                        onChange={(e) => {
                          set(e.target.value);
                          setKotor(true);
                        }}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm tabular-nums focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:bg-slate-100"
                      />
                    </label>
                  ))}
                </div>
              ) : null}

              {ASET_RELEVAN[tab] ? (
                <PanelAsetDi kelompok={props.aset} sorot={ASET_RELEVAN[tab]} />
              ) : null}

              <PohonIndikator
                kodeAkar={tab}
                nilai={nilai}
                keterangan={keterangan}
                nilaiNode={skor.nilai}
                kantongLumpur={kantongLumpur}
                terkunci={!bisaEdit}
                onUbah={ubahNilai}
                onUbahKeterangan={ubahKeterangan}
              />
            </KartuIsi>
          </Kartu>
        )}

        {/* Perpindahan komponen di ujung panel: setelah selesai mengisi, penilai
            lanjut dari tempatnya berada, bukan menggulir balik ke bilah tab. */}
        <div className="flex items-center justify-between gap-3 pb-2">
          {tabSebelum ? (
            <Tombol varian="garis" onClick={() => gantiTab(tabSebelum)} className="min-w-0">
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{labelTab(tabSebelum)}</span>
            </Tombol>
          ) : (
            <span />
          )}
          {tabSesudah ? (
            <Tombol onClick={() => gantiTab(tabSesudah)} className="min-w-0">
              <span className="truncate">{labelTab(tabSesudah)}</span>
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            </Tombol>
          ) : (
            <span />
          )}
        </div>
      </div>

      {/* --------------------------------------------------------- ringkasan */}
      <aside className="xl:sticky xl:top-6 xl:self-start">
        <Kartu>
          <KartuKepala className="flex items-center justify-between">
            <KartuJudul>Nilai IKSI</KartuJudul>
            <Lencana nada={nadaKategori(kategori)}>{INFO_KATEGORI_IKSI[kategori].singkat}</Lencana>
          </KartuKepala>
          <KartuIsi>
            <p className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight tabular-nums text-slate-900">
                {formatAngka(skor.total, 2)}
              </span>
              <span className="text-sm text-slate-400">/ 100</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {INFO_KATEGORI_IKSI[kategori].label} — {INFO_KATEGORI_IKSI[kategori].tindakan}
            </p>

            <div className="mt-4 space-y-2.5">
              {skor.komponen.map((k) => (
                <div key={k.kode}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-slate-600">
                      <span className="font-mono text-slate-400">{k.nomor}</span> {k.label}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-slate-700">
                      {formatAngka(k.nilai, 2)}
                      <span className="text-slate-400">/{k.bobot}</span>
                    </span>
                  </div>
                  <BilahProgres nilai={k.nilai} maks={k.bobot} className="mt-1 h-1.5" />
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-slate-600">Kelengkapan</span>
                <span className="font-mono tabular-nums text-slate-700">
                  {skor.terisi}/{skor.totalIndikator}
                </span>
              </div>
              <BilahProgres
                nilai={skor.terisi}
                maks={skor.totalIndikator}
                className="mt-1.5"
                warnaBilah={lengkap ? "bg-emerald-500" : "bg-brand-600"}
              />
            </div>

            <div className="mt-5 space-y-2">
              {bisaEdit ? (
                <>
                  <Tombol
                    varian="garis"
                    className="w-full"
                    onClick={() => void kirim(false)}
                    disabled={menyimpan}
                  >
                    {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Simpan Draft
                  </Tombol>
                  <Tombol
                    className="w-full"
                    onClick={() => void ajukan()}
                    disabled={menyimpan || !lengkap}
                    title={lengkap ? undefined : "Lengkapi seluruh indikator terlebih dahulu"}
                  >
                    <Send className="h-4 w-4" />
                    Ajukan Penilaian
                  </Tombol>
                </>
              ) : (
                <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                  {info.keterangan}
                </p>
              )}

              {isAdmin && penilaian.status === "diajukan" ? (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-700">Verifikasi Administrator</p>
                  <Tombol className="w-full" onClick={() => void setujui()} disabled={menyimpan}>
                    <ShieldCheck className="h-4 w-4" />
                    Setujui
                  </Tombol>
                  <Tombol
                    varian="garis"
                    className="w-full"
                    onClick={() => void kembalikan()}
                    disabled={menyimpan}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Kembalikan untuk Revisi
                  </Tombol>
                </div>
              ) : null}

              {isAdmin && penilaian.status === "disetujui" ? (
                <Tombol
                  varian="garis"
                  className="mt-2 w-full"
                  onClick={() => void kembalikan()}
                  disabled={menyimpan}
                >
                  <RotateCcw className="h-4 w-4" />
                  Buka Kembali untuk Revisi
                </Tombol>
              ) : null}

              {bisaHapus ? (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <Tombol
                    varian="peringatan"
                    className="w-full"
                    onClick={() => void ulangi()}
                    disabled={menyimpan || mengulangi || menghapus}
                  >
                    {mengulangi ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Ulangi Penilaian
                  </Tombol>
                  <Tombol
                    varian="bahaya"
                    className="w-full"
                    onClick={() => void hapus()}
                    disabled={menyimpan || mengulangi || menghapus}
                  >
                    {menghapus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Hapus Penilaian
                  </Tombol>
                </div>
              ) : null}
            </div>

            <p
              className={cn(
                "mt-3 flex h-4 items-center justify-center gap-1.5 text-xs transition-opacity",
                pesan ? "opacity-100" : "opacity-0",
                pesan?.jenis === "galat" ? "text-rose-600" : "text-emerald-600",
              )}
              role="status"
              aria-live="polite"
            >
              {pesan?.jenis === "ok" ? <Check className="h-3.5 w-3.5" /> : null}
              {pesan?.teks ?? "—"}
            </p>
            {kotor && !pesan ? (
              <p className="mt-1 text-center text-[11px] text-slate-400">
                Perubahan belum tersimpan…
              </p>
            ) : null}
          </KartuIsi>
        </Kartu>
      </aside>
    </div>
  );
}
