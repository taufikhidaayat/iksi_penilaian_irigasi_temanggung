import { NextResponse, type NextRequest } from "next/server";

import { adalahJenisDraf, namaBerkasDraf } from "@/lib/aset-draf";
import { JENIS_ASET } from "@/lib/aset";
import { ambilSatuBerkasDraf, ambilSemuaDraf } from "@/lib/data/aset-draf";
import { bangunDrafExcel } from "@/lib/ekspor/aset-draf-excel";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TIPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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
