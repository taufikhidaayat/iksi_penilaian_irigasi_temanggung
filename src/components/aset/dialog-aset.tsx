"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { AlertCircle, Trash2 } from "lucide-react";

import { Centang, Input, Label, Pemuat, Pilihan, Tombol } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { useKonfirmasi } from "@/components/ui/konfirmasi";
import { useToast } from "@/components/ui/toast";
import {
  JENIS_ASET,
  URUTAN_JENIS,
  type JenisAsetResmi,
  sebutanAset,
  segmenGolongan,
  uraikanKode,
} from "@/lib/aset";
import type { BarisAset } from "@/lib/data/aset";

import { type MuatanAset, hapusAset, simpanAset, tambahAset } from "@/app/(app)/aset/actions";

export interface PilihanDi {
  id: number;
  kode: string;
  nama: string;
}

/** Dialog untuk mengubah aset yang ada, atau menambah aset baru bila `aset` null. */
export function DialogAset({
  aset,
  buka,
  daftarDi,
  bisaHapus,
  onTutup,
}: {
  aset: BarisAset | null;
  buka: boolean;
  daftarDi: PilihanDi[];
  bisaHapus: boolean;
  onTutup: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const konfirmasi = useKonfirmasi();
  const [menunggu, mulai] = useTransition();
  const [galat, setGalat] = useState<string | null>(null);

  const baru = aset === null;
  const [form, setForm] = useState<MuatanAset>(() => ({
    jenis: (aset?.jenis ?? "bendung") as JenisAsetResmi,
    nama: aset?.nama ?? "",
    nomenklatur: aset?.nomenklatur ?? "",
    kode: aset?.kode ?? "",
    diId: aset?.di_id ?? "",
    desa: aset?.desa ?? "",
    kecamatan: aset?.kecamatan ?? "",
    bangunanHulu: aset?.bangunan_hulu ?? "",
    bangunanHilir: aset?.bangunan_hilir ?? "",
    tahun: aset?.tahun ?? "",
    catatan: aset?.catatan ?? "",
    sudahDitinjau: false,
  }));

  const set = <K extends keyof MuatanAset>(k: K, v: MuatanAset[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const info = JENIS_ASET[form.jenis as JenisAsetResmi];
  const uraian = useMemo(() => uraikanKode(String(form.kode ?? "")), [form.kode]);
  const adalahSaluran = form.jenis === "saluran";

  function kirim() {
    setGalat(null);
    mulai(async () => {
      const r = baru ? await tambahAset(form) : await simpanAset(aset!.id, form);
      if (r.ok) {
        toast.sukses(baru ? "Aset ditambahkan" : "Aset diperbarui", form.nama);
        onTutup();
        router.refresh();
      } else {
        setGalat(r.pesan ?? "Gagal menyimpan.");
        toast.galat(baru ? "Gagal menambah aset" : "Gagal menyimpan", r.pesan);
      }
    });
  }

  async function hapus() {
    if (!aset) return;
    const setuju = await konfirmasi({
      judul: "Hapus aset ini?",
      pesan: sebutanAset(aset),
      catatan: "Data yang dihapus tidak bisa dikembalikan.",
      tombolYa: "Ya, hapus",
      nada: "bahaya",
    });
    if (!setuju) return;

    mulai(async () => {
      const r = await hapusAset(aset.id);
      if (r.ok) {
        toast.sukses("Aset dihapus", sebutanAset(aset));
        onTutup();
        router.refresh();
      } else {
        toast.galat("Gagal menghapus", r.pesan);
      }
    });
  }

  return (
    <Dialog
      buka={buka}
      onTutup={onTutup}
      judul={baru ? "Tambah Aset" : "Ubah Aset"}
      deskripsi={baru ? undefined : sebutanAset(aset!)}
      lebar="max-w-2xl"
    >
      <div className="space-y-4">
        {aset?.perlu_tinjau && aset.alasan_tinjau ? (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800 ring-1 ring-amber-200 ring-inset">
            <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden />
            <span>
              <strong>Perlu ditinjau:</strong> {aset.alasan_tinjau}
            </span>
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="a-jenis">Jenis Aset</Label>
            <Pilihan
              id="a-jenis"
              value={form.jenis}
              onChange={(e) => set("jenis", e.target.value as JenisAsetResmi)}
            >
              {URUTAN_JENIS.map((j) => (
                <option key={j} value={j}>
                  {JENIS_ASET[j].label}
                </option>
              ))}
            </Pilihan>
            <p className="mt-1.5 text-xs text-slate-500">{info.keterangan}</p>
          </div>

          <div>
            <Label htmlFor="a-nomen">
              Nomenklatur {info.punyaNomenklatur ? "" : <span className="text-slate-400">(opsional)</span>}
            </Label>
            <Input
              id="a-nomen"
              value={String(form.nomenklatur ?? "")}
              onChange={(e) => set("nomenklatur", e.target.value)}
              placeholder={info.punyaNomenklatur ? "mis. BNDG.0517" : "aset tanah biasanya tanpa nomenklatur"}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="a-nama">Nama Aset</Label>
          <Input
            id="a-nama"
            value={String(form.nama)}
            onChange={(e) => set("nama", e.target.value)}
            placeholder="mis. Bendung Tetap"
          />
        </div>

        <div>
          <Label htmlFor="a-kode">Nomor Aset</Label>
          <Input
            id="a-kode"
            value={String(form.kode ?? "")}
            onChange={(e) => set("kode", e.target.value)}
            // Contoh mengikuti jenis yang sedang dipilih, termasuk segmen
            // golongannya, supaya bentuk yang diharapkan langsung terlihat.
            placeholder={`33.23.${segmenGolongan(form.jenis as JenisAsetResmi)}.01538.${info.kodeTipe}001.2002`}
            className="font-mono text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Salin apa adanya dari Buku Aset Irigasi. Segmen golongan (
            {segmenGolongan(form.jenis as JenisAsetResmi)} untuk {info.label.toLowerCase()}) dan segmen
            UPT + nomor D.I. dipasang otomatis saat disimpan, jadi tidak perlu diketik sendiri.
            Nomor ini tidak unik, jadi jangan dipakai sebagai satu-satunya pembeda antar bangunan.
          </p>
          {uraian ? (
            <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {uraian.map((u, i) => (
                <div key={i} className="rounded-md bg-slate-50 px-2 py-1.5 text-center">
                  <p className="font-mono text-xs font-medium text-slate-700">{u.segmen}</p>
                  <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{u.arti}</p>
                </div>
              ))}
            </div>
          ) : form.kode ? (
            <p className="mt-1.5 text-xs text-amber-700">
              Format belum baku — seharusnya 6 bagian dipisah titik.
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="a-di">Daerah Irigasi</Label>
          <Pilihan
            id="a-di"
            value={String(form.diId ?? "")}
            onChange={(e) => set("diId", e.target.value)}
          >
            <option value="">— belum ditautkan —</option>
            {daftarDi.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nama} ({d.kode})
              </option>
            ))}
          </Pilihan>
          {aset?.nama_di_buku && !aset.di_id ? (
            <p className="mt-1.5 text-xs text-slate-500">
              Di buku tertulis <strong>{aset.nama_di_buku}</strong>
              {aset.kode_di_buku ? ` (kode ${aset.kode_di_buku})` : ""} — pilih padanannya di atas.
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="a-desa">Desa/Kelurahan</Label>
            <Input
              id="a-desa"
              value={String(form.desa ?? "")}
              onChange={(e) => set("desa", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="a-kec">Kecamatan</Label>
            <Input
              id="a-kec"
              value={String(form.kecamatan ?? "")}
              onChange={(e) => set("kecamatan", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="a-tahun">Tahun Bangun</Label>
            <Input
              id="a-tahun"
              type="number"
              value={String(form.tahun ?? "")}
              onChange={(e) => set("tahun", e.target.value)}
              placeholder="2002"
            />
          </div>
        </div>

        {adalahSaluran ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="a-hulu">Bangunan Hulu</Label>
              <Input
                id="a-hulu"
                value={String(form.bangunanHulu ?? "")}
                onChange={(e) => set("bangunanHulu", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="a-hilir">Bangunan Hilir</Label>
              <Input
                id="a-hilir"
                value={String(form.bangunanHilir ?? "")}
                onChange={(e) => set("bangunanHilir", e.target.value)}
              />
            </div>
          </div>
        ) : null}

        <div>
          <Label htmlFor="a-catatan">Catatan</Label>
          <Input
            id="a-catatan"
            value={String(form.catatan ?? "")}
            onChange={(e) => set("catatan", e.target.value)}
            placeholder="Keterangan tambahan, mis. hasil pengecekan lapangan"
          />
        </div>

        {aset?.perlu_tinjau ? (
          <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
            <Centang
              checked={Boolean(form.sudahDitinjau)}
              onChange={(e) => set("sudahDitinjau", e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-xs font-medium text-slate-700">
                Tandai sudah selesai ditinjau
              </span>
              <span className="mt-0.5 block text-[11px] text-slate-500">
                Aset ini akan hilang dari daftar &ldquo;Perlu Ditinjau&rdquo;.
              </span>
            </span>
          </label>
        ) : null}

        {galat ? (
          <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden />
            {galat}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
          {!baru && bisaHapus ? (
            <Tombol varian="hantu" onClick={() => void hapus()} disabled={menunggu}>
              <Trash2 className="h-4 w-4" />
              Hapus
            </Tombol>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Tombol varian="garis" onClick={onTutup} disabled={menunggu}>
              Batal
            </Tombol>
            <Tombol onClick={kirim} disabled={menunggu}>
              {menunggu ? <Pemuat /> : null}
              {baru ? "Tambah" : "Simpan"}
            </Tombol>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
