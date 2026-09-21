"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AlertTriangle,
  Boxes,
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
import { JENIS_ASET } from "@/lib/aset";
import { useKonfirmasi } from "@/components/ui/konfirmasi";
import { useToast } from "@/components/ui/toast";
import {
  gabungNilai,
  indikatorUntukAset,
  statistikPengisian,
  type BarisNilaiAset,
  type BarisNilaiAsetTerisi,
} from "@/lib/iksi/per-bangunan";
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
import { PanelPerBangunan, kunciSel, type PetaNilaiAset } from "./panel-per-bangunan";
import { PohonIndikator } from "./pohon-indikator";

type Simpanan = { ok: boolean; pesan?: string };

/** Tab khusus penilaian per bangunan, disisipkan tepat setelah Komponen I. */
const TAB_BANGUNAN = "bangunan";

/**
 * Ambang cakupan bangunan tuntas. Di bawah ini, Ajukan tetap boleh jalan tapi
 * memperingatkan lebih dulu.
 *
 * Alasannya: skor dihitung per indikator, bukan per bangunan — begitu SATU
 * bangunan saja punya nilai untuk suatu indikator, indikator itu sudah
 * dianggap "terisi" secara sistem, walau bangunan lain belum tersentuh. Tanpa
 * peringatan ini, penilaian dengan data amat tipis bisa lolos diajukan tanpa
 * siapa pun sadar.
 */
const AMBANG_CAKUPAN_RENDAH = 0.5;

/**
 * Urutan perpindahan tab.
 *
 * "Per Bangunan" duduk tepat setelah Prasarana Fisik karena isinya memang
 * bagian dari komponen itu, cuma diisi dengan cara yang berbeda.
 */
const URUTAN_TAB: string[] = (() => {
  const kode = KOMPONEN_UTAMA.map((k) => k.kode);
  const i = kode.indexOf("I");
  return [...kode.slice(0, i + 1), TAB_BANGUNAN, ...kode.slice(i + 1), "areal"];
})();

function labelTab(kode: string): string {
  if (kode === "areal") return "Areal Terdampak";
  if (kode === TAB_BANGUNAN) return "Per Bangunan";
  const node = NODE_BY_KODE.get(kode);
  return node ? `${node.nomor}. ${node.label}` : kode;
}

export interface FormPenilaianProps {
  penilaian: Penilaian;
  di: DaerahIrigasi;
  namaUpt: string;
  nilaiAwal: NilaiInput;
  keteranganAwal: Record<string, string>;
  /** Nilai per bangunan yang sudah tersimpan. */
  nilaiAsetAwal: BarisNilaiAset[];
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
    /**
     * Sengaja boleh `undefined`: artinya "jangan sentuh nilai per bangunan
     * yang sudah tersimpan". Dipakai supaya autosave biasa tidak perlu
     * mengirim ribuan baris tiap dua detik.
     */
    nilaiAset?: BarisNilaiAsetTerisi[];
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

  const [nilaiAset, setNilaiAset] = useState<PetaNilaiAset>(() => {
    const peta: PetaNilaiAset = {};
    for (const b of props.nilaiAsetAwal) {
      if (b.nilai === null) continue;
      peta[kunciSel(b.asetId, b.indikatorKode)] = {
        nilai: b.nilai,
        massal: b.massal ?? false,
      };
    }
    return peta;
  });

  // Nilai per bangunan hanya ikut terkirim bila memang berubah. Satu D.I. bisa
  // punya 5.197 baris, dan mengirimkannya tiap dua detik untuk perubahan yang
  // tidak menyentuhnya sama sekali itu pemborosan yang terasa di lapangan.
  const [asetKotor, setAsetKotor] = useState(false);
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

  /** Bentuk datar nilai per bangunan, sesuai yang diminta mesin rata-rata. */
  const barisAset = useMemo<BarisNilaiAsetTerisi[]>(
    () =>
      Object.entries(nilaiAset).map(([kunci, sel]) => {
        const pisah = kunci.indexOf(":");
        return {
          asetId: Number(kunci.slice(0, pisah)),
          indikatorKode: kunci.slice(pisah + 1),
          nilai: sel.nilai,
          massal: sel.massal,
        };
      }),
    [nilaiAset],
  );

  // Indikator per bangunan nilainya datang dari rata-rata, bukan dari `nilai`.
  // Skor di layar memakai jalur yang sama persis dengan yang dipakai server,
  // supaya angka yang dilihat penilai tidak pernah berbeda dari yang disimpan.
  const nilaiGabungan = useMemo(
    () => gabungNilai(nilai, barisAset),
    [nilai, barisAset],
  );

  const skor = useMemo(
    () => hitungSkor(nilaiGabungan, kantongLumpur),
    [nilaiGabungan, kantongLumpur],
  );
  const kategori = kategoriIksi(skor.total);

  const progresKomponen = useMemo(
    () =>
      KOMPONEN_UTAMA.map((k) => {
        const daun = daunRelevan(k.kode, kantongLumpur);
        const terisi = daun.filter(
          (d) => nilaiGabungan[d] !== null && nilaiGabungan[d] !== undefined,
        ).length;
        return { kode: k.kode, nomor: k.nomor, label: k.label, total: daun.length, terisi };
      }),
    [nilaiGabungan, kantongLumpur],
  );

  /**
   * Sisa indikator kosong per komponen, untuk menerangkan tombol Ajukan yang
   * masih terkunci. Komponen yang sudah tuntas tidak disebut sama sekali.
   */
  const sisaPerKomponen = useMemo(
    () =>
      progresKomponen
        .filter((k) => k.terisi < k.total)
        .map((k) => ({ kode: k.kode, nomor: k.nomor, sisa: k.total - k.terisi })),
    [progresKomponen],
  );

  /** Kelengkapan per jenis bangunan, untuk kartu penunjuk di tab Prasarana Fisik. */
  const kelengkapanJenis = useMemo(() => {
    const stat = statistikPengisian(
      props.aset.flatMap((k) => k.daftar.map((a) => ({ id: a.id, jenis: k.jenis }))),
      barisAset,
      kantongLumpur,
    );
    return new Map<JenisAset, [number, number]>(
      stat.map((s) => [s.jenis, [s.lengkap, s.bangunan]]),
    );
  }, [props.aset, barisAset, kantongLumpur]);

  /** Jenis bangunan yang cakupan penilaiannya masih di bawah ambang. */
  const kelompokCakupanRendah = useMemo(() => {
    const hasil: { jenis: JenisAset; lengkap: number; total: number }[] = [];
    for (const [jenis, [lengkap, total]] of kelengkapanJenis) {
      if (total > 0 && lengkap / total < AMBANG_CAKUPAN_RENDAH) {
        hasil.push({ jenis, lengkap, total });
      }
    }
    return hasil;
  }, [kelengkapanJenis]);

  /** Total bangunan yang sudah dinilai tuntas, untuk lencana pada bilah tab. */
  const ringkasBangunan = useMemo<[number, number]>(() => {
    let selesai = 0;
    let total = 0;
    for (const [lengkap, jml] of kelengkapanJenis.values()) {
      selesai += lengkap;
      total += jml;
    }
    return [selesai, total];
  }, [kelengkapanJenis]);

  /* ----------------------------------------------------- perpindahan tab */

  // Panel isian bisa sangat panjang — komponen I saja 108 sub-indikator — jadi
  // perpindahan komponen tidak boleh bergantung pada bilah tab di puncak
  // halaman saja. Setiap ganti tab, tampilan dikembalikan ke awal panel.
  const awalTab = useRef<HTMLDivElement>(null);

  const gantiTab = useCallback((kode: string) => {
    setTab(kode);
    awalTab.current?.scrollIntoView({ block: "start" });
  }, []);

  /**
   * Tinggi bilah tab yang menempel, dibagikan lewat CSS variable `--bilah-tab`.
   *
   * Panel isian punya kepala yang juga menempel. Tanpa ukuran ini, keduanya
   * berebut baris teratas dan kepala panel tertutup bilah tab — persis
   * informasi yang paling dibutuhkan penilai saat sedang menggulir jauh ke
   * bawah. Tingginya tidak bisa ditulis tetap: bilahnya membungkus jadi satu
   * sampai tiga baris tergantung lebar layar, dan letaknya pun berbeda (di
   * bawah header aplikasi pada layar sempit, di puncak pada layar lebar).
   */
  const bilahTab = useRef<HTMLDivElement>(null);
  const [bilahBawah, setBilahBawah] = useState(56);

  useEffect(() => {
    const el = bilahTab.current;
    if (!el) return;

    const ukur = () => {
      const atas = Number.parseFloat(getComputedStyle(el).top);
      setBilahBawah((Number.isFinite(atas) ? atas : 0) + el.offsetHeight);
    };

    ukur();
    const pengamat = new ResizeObserver(ukur);
    pengamat.observe(el);
    window.addEventListener("resize", ukur);
    return () => {
      pengamat.disconnect();
      window.removeEventListener("resize", ukur);
    };
  }, []);

  /**
   * Jenis bangunan yang sedang dibuka pada tab Per Bangunan.
   *
   * Disimpan di sini, bukan di dalam panel, supaya kartu penunjuk pada tab
   * Prasarana Fisik bisa melompat langsung ke jenis yang bersangkutan. `null`
   * berarti panel memakai jenis pertama yang tersedia.
   */
  const [jenisBangunan, setJenisBangunan] = useState<JenisAset | null>(null);

  const bukaPerBangunan = useCallback(
    (jenis: JenisAset) => {
      setJenisBangunan(jenis);
      gantiTab(TAB_BANGUNAN);
    },
    [gantiTab],
  );

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
      nilaiAset: asetKotor ? barisAset : undefined,
      areal,
    });
    setMenyimpan(false);
    if (hasil.ok) {
      setKotor(false);
      setAsetKotor(false);
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
  }, [penilaian.id, penilaian.catatan, kantongLumpur, jumlahP3a, jumlahGp3a, nilai, keterangan, asetKotor, barisAset, areal, toast]);

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

  const ubahNilaiAset = useCallback((asetId: number, kode: string, v: number | null) => {
    setNilaiAset((s) => {
      const kunci = kunciSel(asetId, kode);
      if (v === null) {
        if (!(kunci in s)) return s;
        const sisa = { ...s };
        delete sisa[kunci];
        return sisa;
      }
      // Diisi tangan berarti bukan hasil pengisian massal lagi, walaupun
      // angkanya kebetulan sama. Yang dicatat adalah cara mengisinya.
      return { ...s, [kunci]: { nilai: v, massal: false } };
    });
    setKotor(true);
    setAsetKotor(true);
  }, []);

  /**
   * Menyalin seluruh nilai satu bangunan ke semua bangunan sejenis.
   *
   * Bangunan yang sudah diperiksa satu per satu TIDAK ditimpa. Pengisian massal
   * itu jalan pintas untuk yang belum disentuh, bukan alat untuk menghapus
   * hasil pemeriksaan yang sudah dikerjakan.
   */
  const salinKeSemua = useCallback(
    (jenis: JenisAset, dariAsetId: number) => {
      const daftar = props.aset.find((k) => k.jenis === jenis)?.daftar ?? [];
      const kodeJenis = indikatorUntukAset(jenis, kantongLumpur);

      setNilaiAset((s) => {
        const berikut = { ...s };
        for (const kode of kodeJenis) {
          const sumber = s[kunciSel(dariAsetId, kode)];
          if (!sumber) continue;
          for (const a of daftar) {
            if (a.id === dariAsetId) continue;
            const kunci = kunciSel(a.id, kode);
            if (berikut[kunci] && !berikut[kunci].massal) continue;
            berikut[kunci] = { nilai: sumber.nilai, massal: true };
          }
        }
        return berikut;
      });

      setKotor(true);
      setAsetKotor(true);
      toast.info(
        "Nilai disalin",
        `Diterapkan ke bangunan sejenis yang belum diperiksa satu per satu.`,
      );
    },
    [props.aset, kantongLumpur, toast],
  );

  async function ajukan() {
    // Cakupan tipis tidak diblokir — sesuai keputusan "rata-rata dari yang
    // terisi saja" — tapi disebutkan di sini supaya pengaju tidak mengajukan
    // tanpa sadar datanya baru mewakili sebagian kecil bangunan.
    const catatanCakupan =
      kelompokCakupanRendah.length > 0
        ? " " +
          kelompokCakupanRendah
            .map(
              (k) =>
                `${JENIS_ASET[k.jenis].label} baru ${k.lengkap} dari ${k.total} bangunan selesai dinilai.`,
            )
            .join(" ")
        : "";

    const setuju = await konfirmasi({
      judul: "Ajukan penilaian ini?",
      pesan: `${di.nama} — ${penilaian.triwulan} ${penilaian.tahun}. Nilai IKSI ${formatAngka(skor.total, 2)} (${INFO_KATEGORI_IKSI[kategori].label}).`,
      catatan:
        "Setelah diajukan, penilaian terkunci dan hanya bisa diubah lagi bila Administrator mengembalikannya untuk revisi." +
        catatanCakupan,
      tombolYa: catatanCakupan ? "Tetap ajukan" : "Ya, ajukan",
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
    <div
      className="grid gap-4 xl:grid-cols-[1fr_20rem]"
      style={{ "--bilah-tab": `${bilahBawah}px` } as CSSProperties}
    >
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
        <div
          ref={bilahTab}
          className="scroll-halus sticky top-14 z-20 -mx-1 overflow-x-auto bg-(--latar) px-1 py-2 lg:top-0 lg:overflow-visible"
        >
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
            }).flatMap((tombol, i) =>
              // "Per Bangunan" duduk tepat setelah Prasarana Fisik, karena
              // isinya memang bagian dari komponen itu.
              progresKomponen[i].kode !== "I"
                ? [tombol]
                : [
                    tombol,
                    <button
                      key={TAB_BANGUNAN}
                      role="tab"
                      aria-selected={tab === TAB_BANGUNAN}
                      onClick={() => gantiTab(TAB_BANGUNAN)}
                      // Lencana tab lain menghitung indikator; yang ini
                      // menghitung bangunan. Disebutkan supaya angkanya tidak
                      // dibaca dengan satuan yang keliru.
                      title={`${ringkasBangunan[0]} dari ${ringkasBangunan[1]} bangunan selesai dinilai`}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                        tab === TAB_BANGUNAN
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                      )}
                    >
                      <Boxes
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          tab === TAB_BANGUNAN ? "text-brand-200" : "text-slate-400",
                        )}
                        aria-hidden
                      />
                      <span className="max-w-36 truncate text-xs font-medium lg:max-w-none">
                        Per Bangunan
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                          tab === TAB_BANGUNAN
                            ? "bg-white/20 text-white"
                            : ringkasBangunan[0] === ringkasBangunan[1] && ringkasBangunan[1] > 0
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {ringkasBangunan[0]}/{ringkasBangunan[1]}
                      </span>
                    </button>,
                  ],
            )}
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
        {tab === TAB_BANGUNAN ? (
          <PanelPerBangunan
            aset={props.aset}
            nilaiAset={nilaiAset}
            kantongLumpur={kantongLumpur}
            namaDi={di.nama}
            terkunci={!bisaEdit}
            jenis={jenisBangunan}
            onGantiJenis={setJenisBangunan}
            onUbah={ubahNilaiAset}
            onSalinKeSemua={salinKeSemua}
          />
        ) : tab === "areal" ? (
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
                kelengkapanJenis={kelengkapanJenis}
                onBukaPerBangunan={bukaPerBangunan}
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

                  {/* Tombol mati tanpa keterangan membuat penilai menebak-nebak
                      apa yang kurang, lalu menyisir tujuh tab satu per satu.
                      Sisanya disebut per komponen dan bisa langsung diklik. */}
                  {!lengkap ? (
                    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                      <p className="text-[11px] leading-relaxed text-slate-600">
                        Bisa diajukan setelah seluruh indikator terisi. Sisa{" "}
                        <strong className="font-semibold">{skor.belumTerisi.length}</strong> di:
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {sisaPerKomponen.map((k) => (
                          <button
                            key={k.kode}
                            type="button"
                            onClick={() => gantiTab(k.kode)}
                            className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-700"
                          >
                            {k.nomor}
                            <span className="ml-1 font-mono text-slate-400">{k.sisa}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
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

              {/* Mengulang dan menghapus dilipat di balik satu baris.
                  Keduanya membuang pekerjaan berjam-jam, dan sebelumnya
                  terpampang sebagai dua tombol penuh warna tepat di bawah
                  "Ajukan Penilaian" — yang paling sering ditekan. Menaruh aksi
                  yang sulit dibatalkan sebesar dan sedekat itu dengan aksi
                  sehari-hari adalah undangan untuk salah klik. */}
              {bisaHapus ? (
                <details className="group border-t border-slate-100 pt-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-1 py-1 text-xs text-slate-500 transition-colors hover:text-slate-700">
                    Tindakan lain
                    <ChevronRight
                      className="h-3.5 w-3.5 transition-transform group-open:rotate-90"
                      aria-hidden
                    />
                  </summary>
                  <div className="mt-2 space-y-2">
                    <Tombol
                      varian="peringatan"
                      ukuran="sm"
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
                      ukuran="sm"
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
                </details>
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
