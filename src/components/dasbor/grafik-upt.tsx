"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BarisRingkasanUpt } from "@/lib/data/ringkasan";
import { INFO_KATEGORI_IKSI, kategoriIksi } from "@/lib/iksi/scoring";
import { warnaKategori } from "@/lib/tampilan";

export function GrafikUpt({ baris }: { baris: BarisRingkasanUpt[] }) {
  const data = baris
    .filter((b) => b.rataIksi !== null)
    .map((b) => ({
      nama: b.kode,
      lengkap: b.nama,
      nilai: Number(b.rataIksi!.toFixed(2)),
      warna: warnaKategori(kategoriIksi(b.rataIksi!)),
    }));

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Belum ada nilai untuk dibandingkan.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="nama"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            formatter={(v) => {
              const nilai = Number(v ?? 0);
              return [`${nilai}% — ${INFO_KATEGORI_IKSI[kategoriIksi(nilai)].label}`, "Rata-rata IKSI"];
            }}
            labelFormatter={(_l, p) => p?.[0]?.payload?.lengkap ?? ""}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              fontSize: 12,
              boxShadow: "0 4px 12px rgb(15 23 42 / 0.08)",
            }}
          />
          <Bar dataKey="nilai" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {data.map((d) => (
              <Cell key={d.nama} fill={d.warna} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
