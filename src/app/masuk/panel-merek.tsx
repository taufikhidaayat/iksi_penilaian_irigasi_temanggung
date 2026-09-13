import { existsSync } from "node:fs";
import { join } from "node:path";

import Image from "next/image";

/**
 * Panel ilustrasi pada halaman masuk.
 *
 * Memakai foto di `public/img/ilustrasi-masuk.*` bila tersedia — urutan di
 * bawah menentukan mana yang dipakai kalau ada lebih dari satu. Kalau belum
 * ada sama sekali, panel jatuh ke ilustrasi SVG skema jaringan irigasi yang
 * digambar inline, jadi halaman tidak pernah menampilkan gambar rusak dan
 * mengganti ilustrasi cukup dengan menaruh berkas baru di jalur itu.
 */
const BERKAS_ILUSTRASI = [
  "img/ilustrasi-masuk.jpg",
  "img/ilustrasi-masuk.jpeg",
  "img/ilustrasi-masuk.webp",
  "img/ilustrasi-masuk.png",
];

function cariIlustrasi(): string | null {
  for (const berkas of BERKAS_ILUSTRASI) {
    try {
      if (existsSync(join(process.cwd(), "public", berkas))) return berkas;
    } catch {
      // Akses berkas gagal: perlakukan seperti tidak ada, lanjut ke kandidat berikutnya.
    }
  }
  return null;
}

export function PanelMerek() {
  const berkas = cariIlustrasi();

  return (
    <div className="relative hidden overflow-hidden rounded-2xl bg-brand-800 lg:block dark:bg-brand-950">
      {berkas ? (
        /* `object-cover` supaya foto mengisi panel penuh dan warnanya utuh;
           keterbacaan teks dijaga oleh peredam di bawah, bukan dengan
           memudarkan gambarnya. */
        <Image
          src={`/${berkas}`}
          alt=""
          fill
          priority
          sizes="(max-width: 1024px) 0px, 480px"
          className="object-cover object-center"
        />
      ) : (
        <IlustrasiIrigasi />
      )}

      {/* Peredup dari bawah supaya tulisan tetap terbaca di atas gambar apa pun. */}
      <div className="absolute inset-0 bg-linear-to-b from-brand-950/80 via-brand-950/15 to-transparent" />

      <div className="relative flex h-full flex-col p-10">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" aria-hidden>
              <path
                d="M12 3c3.5 4.2 5.5 7 5.5 9.5a5.5 5.5 0 1 1-11 0C6.5 10 8.5 7.2 12 3Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="text-2xl leading-snug font-semibold text-white drop-shadow-sm">
            Penilaian Kinerja Sistem
            <br />
            Irigasi
          </h2>
        </div>
      </div>
    </div>
  );
}

/** Cadangan bila berkas ilustrasi belum dipasang: skema jaringan irigasi. */
function IlustrasiIrigasi() {
  return (
    <>
      <div className="absolute inset-0 bg-linear-to-br from-brand-600 via-brand-800 to-brand-950 dark:from-brand-800 dark:via-brand-950 dark:to-slate-950" />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 560"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <linearGradient id="air" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.25" />
          </linearGradient>
          <pattern id="kisi" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0v40" fill="none" stroke="#ffffff" strokeOpacity="0.06" />
          </pattern>
        </defs>

        <rect width="400" height="560" fill="url(#kisi)" />

        {[
          [40, 300],
          [120, 300],
          [200, 300],
          [40, 372],
          [120, 372],
          [200, 372],
          [40, 444],
          [120, 444],
        ].map(([x, y]) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="64"
            height="56"
            rx="6"
            fill="#ffffff"
            fillOpacity="0.05"
            stroke="#ffffff"
            strokeOpacity="0.16"
          />
        ))}

        <path d="M40 250 H360" stroke="url(#air)" strokeWidth="10" strokeLinecap="round" fill="none" />

        {[72, 152, 232].map((x) => (
          <path
            key={x}
            d={`M${x} 250 V492`}
            stroke="url(#air)"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
          />
        ))}

        <g transform="translate(150 150)">
          <path
            d="M0 60 L26 0 H74 L100 60 Z"
            fill="#ffffff"
            fillOpacity="0.12"
            stroke="#bfdbfe"
            strokeOpacity="0.7"
            strokeWidth="2"
          />
          <path d="M14 60 H86" stroke="#bfdbfe" strokeOpacity="0.5" strokeWidth="2" />
          <path d="M50 0 V60" stroke="#bfdbfe" strokeOpacity="0.4" strokeWidth="2" />
        </g>

        <path
          d="M200 40 C 200 80, 168 100, 200 150"
          stroke="url(#air)"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </>
  );
}
