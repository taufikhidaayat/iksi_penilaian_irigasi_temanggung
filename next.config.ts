import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Berkas draf (.xlsx, dan .dbf untuk Bendung Baru) dibaca dari disk oleh
   * /api/aset-draf/[jenis]?asli=1.
   * Penelusuran berkas Next hanya mengikuti `import`, jadi `data/aset-draf/`
   * harus disebut supaya ikut terbawa pada build standalone. Tanpa ini, tombol
   * "Berkas asli" jalan di dev tetapi 404 di produksi.
   */
  outputFileTracingIncludes: {
    "/api/aset-draf/[jenis]": ["./data/aset-draf/**"],
  },
};

export default nextConfig;
