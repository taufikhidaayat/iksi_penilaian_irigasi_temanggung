import { NextResponse, type NextRequest } from "next/server";

import { ambilRekap } from "@/lib/data/rekap";
import { bangunRekapExcel, namaBerkasRekap } from "@/lib/ekspor/rekap-excel";
import { TRIWULAN } from "@/lib/periode";
import { createClient } from "@/lib/supabase/server";
import type { PeriodeTriwulan } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ pesan: "Tidak terautentikasi." }, { status: 401 });
  }

  const { data: profil } = await supabase
    .from("profil")
    .select("peran, upt_id, aktif")
    .eq("id", user.id)
    .single();

  if (!profil?.aktif) {
    return NextResponse.json({ pesan: "Akun tidak aktif." }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const tahun = Number(sp.get("tahun"));
  const tw = sp.get("triwulan") ?? "";

  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) {
    return NextResponse.json({ pesan: "Tahun tidak valid." }, { status: 400 });
  }
  if (!TRIWULAN.includes(tw as PeriodeTriwulan)) {
    return NextResponse.json({ pesan: "Triwulan tidak valid." }, { status: 400 });
  }

  const isAdmin = profil.peran === "admin";
  const uptDiminta = sp.get("upt");

  // Pengguna UPT selalu terkunci pada wilayahnya sendiri, apa pun isi query.
  const uptId = isAdmin ? (uptDiminta ? Number(uptDiminta) : null) : profil.upt_id;
  if (uptId !== null && !Number.isInteger(uptId)) {
    return NextResponse.json({ pesan: "UPT tidak valid." }, { status: 400 });
  }

  const rekap = await ambilRekap({
    tahun,
    triwulan: tw as PeriodeTriwulan,
    uptId,
    hanyaDisetujui: sp.get("final") === "1",
  });

  let labelUpt: string | null = null;
  if (uptId !== null) {
    const { data } = await supabase.from("upt").select("nama").eq("id", uptId).maybeSingle();
    labelUpt = data?.nama ?? null;
  }

  const buffer = await bangunRekapExcel(rekap, {
    labelUpt,
    tandaTangan: {
      tempatTanggal: sp.get("ttdTempat") || "Temanggung,",
      jabatan: (sp.get("ttdJabatan") || "KEPALA DINAS PEKERJAAN UMUM|DAN PENATAAN RUANG|KABUPATEN TEMANGGUNG")
        .split("|")
        .filter(Boolean),
      nama: sp.get("ttdNama") || "",
      nip: sp.get("ttdNip") || "NIP.",
    },
  });

  const namaBerkas = namaBerkasRekap(tahun, tw, labelUpt);

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${namaBerkas}"`,
      "Cache-Control": "no-store",
    },
  });
}
