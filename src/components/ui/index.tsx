"use client";

import * as React from "react";

import { Check, ChevronDown } from "lucide-react";
import { FaFileExcel } from "react-icons/fa6";

import { cn } from "@/lib/utils";

/* ----------------------------------------------------------- Tombol */

type VarianTombol = "utama" | "sekunder" | "garis" | "hantu" | "bahaya" | "peringatan" | "excel";
type UkuranTombol = "sm" | "md" | "lg" | "ikon";

const VARIAN: Record<VarianTombol, string> = {
  utama:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300",
  sekunder:
    "bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:text-brand-400 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25",
  garis:
    "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800",
  hantu:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
  bahaya: "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300",
  // Sama seperti nada "peringatan" di dialog konfirmasi (amber) — untuk aksi yang
  // mengubah/mengosongkan data tapi tidak sepenuhnya menghapusnya (mis. "Ulangi").
  peringatan: "bg-amber-500 text-white shadow-sm hover:bg-amber-600 active:bg-amber-700 disabled:bg-amber-300",
  // Hijau Excel. Dipakai HANYA oleh tombol yang menghasilkan berkas .xlsx —
  // lihat catatan pada --color-excel-600 di globals.css.
  excel:
    "bg-excel-600 text-white shadow-sm hover:bg-excel-700 active:bg-excel-800 disabled:bg-excel-600/40",
};

const UKURAN: Record<UkuranTombol, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
  ikon: "h-9 w-9",
};

export interface TombolProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  varian?: VarianTombol;
  ukuran?: UkuranTombol;
}

export const Tombol = React.forwardRef<HTMLButtonElement, TombolProps>(function Tombol(
  { className, varian = "utama", ukuran = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap",
        "transition-colors disabled:pointer-events-none disabled:opacity-70",
        VARIAN[varian],
        UKURAN[ukuran],
        className,
      )}
      {...props}
    />
  );
});

/* ------------------------------------------------------- Ikon Excel */

/**
 * Penanda berkas .xlsx, dipakai seluruh proyek.
 *
 * Logo Microsoft Excel yang sebenarnya tidak tersedia di paket ikon yang
 * terpasang — Simple Icons mencabut ikon merek Microsoft karena lisensi — jadi
 * yang dipakai lambang berkas Excel dari Font Awesome. Dibungkus di sini supaya
 * kalau suatu saat lambangnya diganti, cukup satu berkas yang disunting.
 *
 * Di atas tombol varian "excel" ikonnya putih; di atas latar terang ia memakai
 * hijau Excel lewat `className`.
 */
export function IkonExcel({ className }: { className?: string }) {
  return <FaFileExcel className={cn("h-4 w-4 shrink-0", className)} aria-hidden />;
}

/* ------------------------------------------------------------ Kartu */

export function Kartu({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("kartu shadow-sm dark:border-slate-800 dark:bg-slate-900", className)}
      {...props}
    />
  );
}

export function KartuKepala({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-b border-slate-200 px-5 py-4 dark:border-slate-800", className)}
      {...props}
    />
  );
}

export function KartuJudul({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-sm font-semibold text-slate-900 dark:text-slate-100", className)}
      {...props}
    />
  );
}

export function KartuIsi({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

/* ------------------------------------------------------------ Input */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900",
          "placeholder:text-slate-400 transition-colors",
          "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500",
          "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none",
          "disabled:bg-slate-50 disabled:text-slate-500 dark:disabled:bg-slate-800",
          className,
        )}
        {...props}
      />
    );
  },
);

/* ---------------------------------------------------------- Centang */

export interface CentangProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "checked"> {
  checked: boolean;
}

/**
 * Kotak centang bergaya sendiri. `<input>` aslinya tetap ada dan menangani
 * semantik/keyboard, hanya disamarkan transparan agar kotak visualnya bisa
 * digambar bebas — `accent-color` bawaan browser menyerahkan bentuknya ke
 * sistem operasi (lih. slider nilai indikator untuk masalah yang sama).
 */
export const Centang = React.forwardRef<HTMLInputElement, CentangProps>(function Centang(
  { className, checked, disabled, ...props },
  ref,
) {
  return (
    <span className={cn("relative inline-flex h-4.5 w-4.5 shrink-0", className)}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none flex h-4.5 w-4.5 items-center justify-center rounded-md border transition-colors duration-150",
          checked
            ? "border-brand-600 bg-brand-600"
            : "border-slate-300 bg-white peer-hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:peer-hover:border-slate-500",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600",
          disabled && "opacity-50",
        )}
      >
        <Check
          className={cn(
            "h-3 w-3 text-white transition-transform duration-150",
            checked ? "scale-100" : "scale-0",
          )}
          strokeWidth={3}
          aria-hidden
        />
      </span>
    </span>
  );
});

interface OpsiPilihan {
  nilai: string;
  label: string;
  disabled: boolean;
}

/**
 * Merangkai isi sebuah <option> menjadi teks.
 *
 * Isi option kerap tersusun dari beberapa potong, mis.
 * `<option>{d.nama} ({d.kode})</option>` yang bagi React adalah array
 * `["D.I. Aji Bandunggede", " (", "33230287", ")"]`, bukan satu string.
 *
 * Versi sebelumnya hanya menerima string atau angka dan selebihnya jatuh ke
 * NILAI option. Akibatnya dropdown Daerah Irigasi di dialog Aset menampilkan
 * "287" — id barisnya — padahal seharusnya "D.I. Aji Bandunggede (33230287)".
 * Select aslinya tetap benar, jadi datanya tersimpan dengan betul; yang salah
 * hanya yang dibaca petugas, dan itu justru yang dipakai untuk memutuskan.
 */
function teksAnak(anak: React.ReactNode): string {
  if (anak == null || typeof anak === "boolean") return "";
  if (typeof anak === "string" || typeof anak === "number") return String(anak);
  if (Array.isArray(anak)) return anak.map(teksAnak).join("");
  if (React.isValidElement(anak)) {
    return teksAnak((anak.props as { children?: React.ReactNode }).children);
  }
  return "";
}

/** Membaca elemen <option> anak jadi data polos — termasuk yang datang dari .map() atau kondisi (&&). */
function opsiDariAnak(children: React.ReactNode): OpsiPilihan[] {
  const hasil: OpsiPilihan[] = [];
  React.Children.forEach(children, (anak) => {
    if (!React.isValidElement(anak) || anak.type !== "option") return;
    const p = anak.props as React.OptionHTMLAttributes<HTMLOptionElement>;
    const nilai = p.value == null ? "" : String(p.value);
    // Nilai hanya dipakai sebagai jaring terakhir, bila option memang kosong.
    const label = teksAnak(p.children).trim() || nilai;
    hasil.push({ nilai, label, disabled: Boolean(p.disabled) });
  });
  return hasil;
}

/**
 * Set nilai lewat setter native lalu picu event `change` sungguhan, supaya listener
 * `onChange` React yang terpasang di <select> asli tetap jalan — persis seperti
 * pengguna memilih opsi secara langsung, tanpa perlu memalsukan objek event.
 */
function setNilaiSelectAsli(el: HTMLSelectElement, nilai: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
  setter?.call(el, nilai);
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function gabungRef<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (nilai: T | null) => {
    for (const r of refs) {
      if (!r) continue;
      if (typeof r === "function") r(nilai);
      else (r as React.RefObject<T | null>).current = nilai;
    }
  };
}

/**
 * Dropdown gaya kustom (panel melayang, opsi terpilih disorot warna brand) — bukan
 * <select> bawaan, karena tampilan popup native tidak bisa diberi gaya lintas-browser.
 *
 * Tetap ada <select> asli di baliknya (disembunyikan via `sr-only`, bukan dilepas),
 * jadi `name`/`required`/FormData/validasi form berjalan seperti biasa; panel yang
 * terlihat hanya lapisan tampilan yang menulis ke situ lewat `setNilaiSelectAsli`.
 * Prop-nya sengaja tetap sama seperti <select> supaya semua pemanggil tidak perlu diubah.
 */
export const Pilihan = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Pilihan(
  { className, children, value, defaultValue, onChange, disabled, required, id, name, "aria-label": ariaLabel, ...rest },
  ref,
) {
  const opsi = React.useMemo(() => opsiDariAnak(children), [children]);
  const terkendali = value !== undefined;
  const [nilaiSendiri, setNilaiSendiri] = React.useState(() =>
    defaultValue != null ? String(defaultValue) : (opsi[0]?.nilai ?? ""),
  );
  const nilaiSekarang = terkendali ? String(value) : nilaiSendiri;
  const labelSekarang = opsi.find((o) => o.nilai === nilaiSekarang)?.label ?? "";

  const [terbuka, setTerbuka] = React.useState(false);
  const [aktifIndeks, setAktifIndeks] = React.useState(0);

  const kotakRef = React.useRef<HTMLDivElement>(null);
  const aslinyaRef = React.useRef<HTMLSelectElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const listboxId = React.useId();

  React.useEffect(() => {
    if (!terbuka) return;
    function tutupJikaLuar(e: MouseEvent) {
      if (kotakRef.current && !kotakRef.current.contains(e.target as Node)) setTerbuka(false);
    }
    document.addEventListener("mousedown", tutupJikaLuar);
    return () => document.removeEventListener("mousedown", tutupJikaLuar);
  }, [terbuka]);

  React.useEffect(() => {
    if (!terbuka) return;
    panelRef.current?.querySelector(`[data-idx="${aktifIndeks}"]`)?.scrollIntoView({ block: "nearest" });
  }, [terbuka, aktifIndeks]);

  function pilih(nilai: string) {
    if (!terkendali) setNilaiSendiri(nilai);
    if (aslinyaRef.current) setNilaiSelectAsli(aslinyaRef.current, nilai);
    setTerbuka(false);
  }

  function bukaKotak() {
    if (disabled || opsi.length === 0) return;
    const indeksAwal = opsi.findIndex((o) => o.nilai === nilaiSekarang);
    setAktifIndeks(Math.max(0, indeksAwal));
    setTerbuka(true);
  }

  function padaKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!terbuka) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        bukaKotak();
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setTerbuka(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setAktifIndeks((i) => Math.min(opsi.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setAktifIndeks((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setAktifIndeks(0);
        break;
      case "End":
        e.preventDefault();
        setAktifIndeks(opsi.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (opsi[aktifIndeks] && !opsi[aktifIndeks].disabled) pilih(opsi[aktifIndeks].nilai);
        break;
    }
  }

  return (
    <div ref={kotakRef} className={cn("relative w-full", className)}>
      <select
        ref={gabungRef(ref, aslinyaRef)}
        name={name}
        required={required}
        disabled={disabled}
        value={terkendali ? value : undefined}
        defaultValue={terkendali ? undefined : defaultValue}
        onChange={onChange}
        tabIndex={-1}
        aria-hidden
        className="sr-only pointer-events-none"
        {...rest}
      >
        {children}
      </select>

      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={terbuka}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={() => (terbuka ? setTerbuka(false) : bukaKotak())}
        onKeyDown={padaKeyDown}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-sm transition-colors",
          "text-slate-900 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700",
          terbuka
            ? "border-brand-500 ring-2 ring-brand-500/20"
            : "hover:border-slate-400 dark:hover:border-slate-600",
          !terbuka && "border-slate-300 focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/20",
          "focus:outline-none",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:disabled:bg-slate-800",
        )}
      >
        <span className="truncate">{labelSekarang}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform",
            terbuka && "rotate-180 text-brand-600 dark:text-brand-400",
          )}
          aria-hidden
        />
      </button>

      {terbuka ? (
        <div
          ref={panelRef}
          role="listbox"
          id={listboxId}
          className={cn(
            // z-40, bukan z-20: bilah tab pada form penilaian juga z-20 dan
            // berada lebih belakang di DOM, sehingga pada nilai yang sama panel
            // ini kalah dan tertimpa. Pembungkus `relative` di atas tidak
            // membuat konteks penumpukan sendiri, jadi perbandingannya terjadi
            // di tingkat halaman. Menaikkan nilai di sini lebih tepat daripada
            // menurunkan bilah tab, yang memang harus menutupi isi saat digulir.
            //
            // Urutan lapisan aplikasi: bilah tab 20 < header 30 < panel ini 40
            // < laci sidebar 50 < toast 100. Panel harus tetap di bawah laci,
            // supaya dropdown di balik laci yang terbuka tidak menembusnya.
            "absolute z-40 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1.5",
            "text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900",
          )}
        >
          {opsi.map((o, i) => {
            const dipilih = o.nilai === nilaiSekarang;
            return (
              <div
                key={o.nilai || `_kosong_${i}`}
                data-idx={i}
                role="option"
                id={`${listboxId}-opt-${i}`}
                aria-selected={dipilih}
                aria-disabled={o.disabled || undefined}
                onMouseEnter={() => setAktifIndeks(i)}
                onClick={() => !o.disabled && pilih(o.nilai)}
                className={cn(
                  "cursor-pointer rounded-lg px-3 py-2 transition-colors",
                  dipilih
                    ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                    : "text-slate-700 dark:text-slate-200",
                  i === aktifIndeks && !dipilih && "bg-slate-50 dark:bg-slate-800",
                  o.disabled && "cursor-not-allowed text-slate-300 dark:text-slate-600",
                )}
              >
                {o.label}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400", className)}
      {...props}
    />
  );
}

/* ----------------------------------------------------------- Lencana */

const NADA = {
  netral: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  biru: "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30",
  hijau: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  kuning: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  merah: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
} as const;

export type NadaLencana = keyof typeof NADA;

export function Lencana({
  nada = "netral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { nada?: NadaLencana }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        NADA[nada],
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------- Bilah Progres */

export function BilahProgres({
  nilai,
  maks = 100,
  className,
  warnaBilah = "bg-brand-600",
}: {
  nilai: number;
  maks?: number;
  className?: string;
  warnaBilah?: string;
}) {
  const persen = maks > 0 ? Math.min(100, Math.max(0, (nilai / maks) * 100)) : 0;
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800", className)}
      role="progressbar"
      aria-valuenow={Math.round(persen)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", warnaBilah)}
        style={{ width: `${persen}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------- Lain */

export function KosongData({
  judul,
  pesan,
  aksi,
}: {
  judul: string;
  pesan?: string;
  aksi?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{judul}</p>
      {pesan ? (
        <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{pesan}</p>
      ) : null}
      {aksi ? <div className="mt-5">{aksi}</div> : null}
    </div>
  );
}

export function Pemuat({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      aria-hidden
    />
  );
}
