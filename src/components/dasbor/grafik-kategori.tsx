"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { INFO_KATEGORI_IKSI } from "@/lib/iksi/scoring";
import type { KategoriIksi } from "@/lib/iksi/types";
import { URUTAN_KATEGORI, warnaKategori } from "@/lib/tampilan";

export function GrafikKategori({ distribusi }: { distribusi: Record<KategoriIksi, number> }) {
  const data = URUTAN_KATEGORI.map((k) => ({
    kategori: k,
    nama: INFO_KATEGORI_IKSI[k].label,
    jumlah: distribusi[k],
    warna: warnaKategori(k),
  })).filter((d) => d.jumlah > 0);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Belum ada penilaian final pada periode ini.
      </div>
    );
  }

  const total = data.reduce((a, d) => a + d.jumlah, 0);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="jumlah"
            nameKey="nama"
            innerRadius="55%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.kategori} fill={d.warna} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, n) => {
              const jumlah = Number(v ?? 0);
              return [`${jumlah} D.I. (${((jumlah / total) * 100).toFixed(1)}%)`, String(n ?? "")];
            }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              fontSize: 12,
              boxShadow: "0 4px 12px rgb(15 23 42 / 0.08)",
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(v: string) => <span className="text-xs text-slate-600">{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
