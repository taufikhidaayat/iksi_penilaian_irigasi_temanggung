import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { adalahJenisDraf, namaBerkasDraf } from "@/lib/aset-draf";
import { JENIS_ASET } from "@/lib/aset";
import { ambilSatuBerkasDraf, ambilSemuaDraf } from "@/lib/data/aset-draf";
import { bangunDrafExcel } from "@/lib/ekspor/aset-draf-excel";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TIPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Tipe MIME berkas draf asli, menurut ekstensinya.
 *
 * Tujuh berkas draf berformat .xlsx, tetapi Bendung Baru datang sebagai .dbf
 * dari GIS. Mengirimnya dengan tipe .xlsx membuat Excel menolak membukanya
 * dengan keluhan format tidak sesuai, padahal berkasnya utuh.
 */
function tipeBerkasAsli(nama: string): string {
  return nama.toLowerCase().endsWith(".dbf") ? "application/x-dbf" : TIPE_XLSX;
}

/** Berkas draf asli disimpan di luar `public/` supaya tetap lewat pemeriksaan sesi. */
const DIR_BERKAS = join(process.cwd(), "data", "aset-draf");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jenis: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ pesan: "Tidak terautentikasi." }, { status: 401 });
  }

  const { data: profil } = await supabase
    .from("profil")
    .select("peran, aktif")
    .eq("id", user.id)
    .single();

  // Draf belum terverifikasi, jadi tertutup untuk petugas UPT — sama seperti
  // halamannya. RLS sudah menolak, tetapi route ini memakai sesi pengguna juga
  // untuk membaca berkas dari disk, yang tidak tersentuh RLS.
  if (!profil?.aktif || profil.peran !== "admin") {
    return NextResponse.json({ pesan: "Khusus administrator." }, { status: 403 });
  }

  const { jenis } = await params;
  if (!adalahJenisDraf(jenis)) {
    return NextResponse.json({ pesan: "Jenis aset tidak dikenal." }, { status: 404 });
  }

  const berkas = await ambilSatuBerkasDraf(jenis);
  if (!berkas) {
    return NextResponse.json({ pesan: "Data draf belum diimpor." }, { status: 404 });
  }

  const label = JENIS_ASET[jenis].label;

  // ?asli=1 mengirim berkas draf apa adanya, tanpa kodefikasi nomor aset.
  if (request.nextUrl.searchParams.get("asli") === "1") {
    // basename memotong komponen direktori: nama berkas berasal dari database,
    // dan tidak ada gunanya mempercayainya sebagai lintasan.
    const nama = basename(berkas.nama_berkas);
    try {
      const isi = await readFile(join(DIR_BERKAS, nama));
      return new NextResponse(new Uint8Array(isi), {
        headers: {
          "Content-Type": tipeBerkasAsli(nama),
          "Content-Disposition": `attachment; filename="${nama}"`,
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return NextResponse.json(
        { pesan: `Berkas asli ${nama} tidak ditemukan di server.` },
        { status: 404 },
      );
    }
  }

  const baris = await ambilSemuaDraf(jenis);
  const buffer = await bangunDrafExcel(berkas, baris);

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": TIPE_XLSX,
      "Content-Disposition": `attachment; filename="${namaBerkasDraf(label)}"`,
      "Cache-Control": "no-store",
    },
  });
}
