import Link from "next/link";
import { notFound } from "next/navigation";

import { ChevronLeft } from "lucide-react";

import { FormPenilaian } from "@/components/penilaian/form-penilaian";
import { ambilSesi } from "@/lib/auth";
import { ambilAsetPerDi } from "@/lib/data/aset";
import { ambilPenilaian } from "@/lib/data/penilaian";

import { hapusPenilaian, simpanPenilaian, ubahStatus, ulangiPenilaian } from "../actions";

export default async function HalamanFormPenilaian({ params }: PageProps<"/penilaian/[id]">) {
  const { id } = await params;
  const sesi = await ambilSesi();
  const data = await ambilPenilaian(id);

  if (!data) notFound();

  const { penilaian, di, upt, nilai, keterangan, areal } = data;

  // RLS sudah membatasi, tetapi tegaskan juga di lapisan render.
  if (!sesi.isAdmin && penilaian.upt_id !== sesi.profil.upt_id) notFound();

  const bisaEdit = sesi.isAdmin || ["draft", "revisi"].includes(penilaian.status);
  const aset = await ambilAsetPerDi(di.id);

  async function simpan(muatan: Parameters<typeof simpanPenilaian>[0]) {
    "use server";
    return simpanPenilaian(muatan);
  }

  async function ajukan() {
    "use server";
    return ubahStatus(id, "diajukan");
  }

  async function setujui() {
    "use server";
    return ubahStatus(id, "disetujui");
  }

  async function revisi() {
    "use server";
    return ubahStatus(id, "revisi");
  }

  async function ulangi() {
    "use server";
    return ulangiPenilaian(id);
  }

  async function hapus() {
    "use server";
    return hapusPenilaian(id);
  }

  return (
    <>
      <Link
        href="/penilaian"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-brand-600"
      >
        <ChevronLeft className="h-4 w-4" />
        Kembali ke daftar penilaian
      </Link>

      <FormPenilaian
        penilaian={penilaian}
        di={di}
        namaUpt={upt?.nama ?? "—"}
        nilaiAwal={nilai}
        keteranganAwal={keterangan}
        arealAwal={areal}
        bisaEdit={bisaEdit}
        isAdmin={sesi.isAdmin}
        aset={aset}
        onSimpan={simpan}
        onAjukan={ajukan}
        onSetujui={setujui}
        onRevisi={revisi}
        onUlangi={ulangi}
        onHapus={hapus}
      />
    </>
  );
}
