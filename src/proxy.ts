import type { NextRequest } from "next/server";

import { perbaruiSesi } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return perbaruiSesi(request);
}

export const config = {
  matcher: [
    // Semua rute kecuali aset statis dan berkas gambar.
    // `\\.` sengaja ganda: dalam string TS itu menghasilkan `\.` di regex,
    // yakni titik literal. Satu backslash saja akan tereskap jadi `.` (karakter apa pun).
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
