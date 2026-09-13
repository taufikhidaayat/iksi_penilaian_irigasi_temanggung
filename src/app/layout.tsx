import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Penyedia } from "@/components/penyedia";
import { SKRIP_TEMA } from "@/components/ui/tema";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sistem Penilaian Kinerja Sistem Irigasi",
    template: "%s · Sistem Penilaian Kinerja Sistem Irigasi",
  },
  description:
    "Penilaian Indeks Kinerja Sistem Irigasi (IKSI) Kabupaten Temanggung sesuai Permen PUPR No. 12/PRT/M/2015.",
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Menyetel kelas tema sebelum halaman digambar, mencegah kedipan. */}
        <script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <Penyedia>{children}</Penyedia>
      </body>
    </html>
  );
}
