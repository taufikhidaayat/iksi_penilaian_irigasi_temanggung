import { Shell } from "@/components/layout/shell";
import { ambilSesi } from "@/lib/auth";
import { menuUntuk } from "@/lib/nav";

import { keluar } from "../masuk/actions";

export default async function LayoutAplikasi({ children }: LayoutProps<"/">) {
  const sesi = await ambilSesi();

  return (
    <Shell
      menu={menuUntuk(sesi.isAdmin)}
      nama={sesi.profil.nama}
      peran={sesi.isAdmin ? "Administrator" : "UPT"}
      namaUpt={sesi.isAdmin ? "Semua UPT" : (sesi.upt?.nama ?? "—")}
      kodeUpt={sesi.isAdmin ? "AD" : (sesi.upt?.kode ?? null)}
      onKeluar={keluar}
    >
      {children}
    </Shell>
  );
}
