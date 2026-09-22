import { describe, expect, it } from "vitest";

import {
  letakAset,
  namaDiBerbeda,
  penandaKembar,
  rincianAset,
  ruasAset,
  nomorAset,
  terapkanGolongan,
  terapkanWilayah,
  uraikanKode,
} from "./aset";

/**
 * Identitas bangunan saat mengisi penilaian.
 *
 * Penilaian dikerjakan per bangunan, jadi salah mengenali baris berarti nilai
 * masuk ke bangunan yang keliru — dan tidak ada satu pun mekanisme lain yang
 * akan menangkapnya. Berkas ini menguji keping-keping yang dipakai penilai
 * untuk memastikan baris di layar adalah bangunan yang sedang ia periksa.
 *
 * Contoh datanya diambil apa adanya dari database, bukan dikarang.
 */

const SALURAN_SIRANDU = {
  id: 1,
  nomenklatur: "SAL.04022",
  nama: "Saluran Sekunder",
  kode: "33.23.010306.0538.02001.2002",
  desa: "Watukumpul",
  kecamatan: "Parakan",
  bangunan_hulu: "Buang",
  bangunan_hilir: "Sadap Alam",
};

describe("ruasAset", () => {
  it("menyusun ruas dari bangunan hulu dan hilir", () => {
    expect(ruasAset(SALURAN_SIRANDU)).toBe("Buang → Sadap Alam");
  });

  it("menandai sisi yang kosong, bukan menyembunyikan ruasnya", () => {
    expect(ruasAset({ bangunan_hulu: "Bendung", bangunan_hilir: null })).toBe("Bendung → ?");
    expect(ruasAset({ bangunan_hulu: null, bangunan_hilir: "Corong" })).toBe("? → Corong");
  });

  it("tidak mengarang ruas untuk bangunan yang memang tidak punya", () => {
    expect(ruasAset({ bangunan_hulu: null, bangunan_hilir: null })).toBeNull();
  });
});

describe("letakAset", () => {
  it("menggabungkan desa dan kecamatan", () => {
    expect(letakAset(SALURAN_SIRANDU)).toBe("Watukumpul, Kec. Parakan");
  });

  it("tetap memberi letak walau hanya salah satunya ada", () => {
    expect(letakAset({ desa: "Jamusan", kecamatan: null })).toBe("Jamusan");
    expect(letakAset({ desa: null, kecamatan: "Kedu" })).toBe("Kec. Kedu");
  });

  it("mengembalikan null bila letaknya memang belum dicatat", () => {
    // 556 gorong-gorong di register tidak punya desa maupun kecamatan.
    expect(letakAset({ desa: null, kecamatan: null })).toBeNull();
  });
});

describe("rincianAset", () => {
  it("memuat seluruh keping identitas sebuah saluran", () => {
    const r = rincianAset(SALURAN_SIRANDU, "saluran");
    expect(r.map((x) => x.label)).toEqual([
      "Jenis",
      "Nomenklatur",
      "Ruas",
      "Panjang",
      "Letak",
      "Nomor aset",
    ]);
    expect(r.find((x) => x.label === "Ruas")?.nilai).toBe("Buang → Sadap Alam");
    expect(r.find((x) => x.label === "Nomor aset")?.nilai).toBe(SALURAN_SIRANDU.kode);
  });

  it("menampilkan panjang saluran dipotong dua angka, tidak dibulatkan", () => {
    const r = rincianAset({ ...SALURAN_SIRANDU, panjang: 408.753658239 }, "saluran");
    expect(r.find((x) => x.label === "Panjang")?.nilai).toBe("408,75 m");
  });

  it("menandai panjang yang belum terdata, bukan menghilangkan barisnya", () => {
    const r = rincianAset({ ...SALURAN_SIRANDU, panjang: null }, "saluran");
    const panjang = r.find((x) => x.label === "Panjang");
    expect(panjang?.nilai).toBe("belum terdata");
    expect(panjang?.kosong).toBe(true);
  });

  it("membedakan panjang 0 dari panjang yang belum terdata", () => {
    // 43 saluran tercatat 0 di berkas GIS; itu keterangan, bukan data kosong.
    const r = rincianAset({ ...SALURAN_SIRANDU, panjang: 0 }, "saluran");
    expect(r.find((x) => x.label === "Panjang")?.nilai).toBe("0,00 m");
  });

  it("tidak menyebut panjang pada jenis selain saluran", () => {
    const r = rincianAset(SALURAN_SIRANDU, "bendung");
    expect(r.map((x) => x.label)).not.toContain("Panjang");
  });

  it("menampilkan keping yang kosong sebagai peringatan, bukan menghilangkannya", () => {
    const r = rincianAset(
      {
        nomenklatur: null,
        nama: "Gorong-Gorong Di Saluran Pembawa",
        kode: null,
        desa: null,
        kecamatan: null,
        bangunan_hulu: null,
        bangunan_hilir: null,
      },
      "gorong_gorong",
    );
    const letak = r.find((x) => x.label === "Letak");
    expect(letak?.kosong).toBe(true);
    expect(letak?.nilai).toBe("belum dicatat");
    expect(r.find((x) => x.label === "Nomor aset")?.kosong).toBe(true);
  });

  it("tidak menanyakan nomenklatur pada jenis yang memang tidak memakainya", () => {
    const r = rincianAset(
      {
        nomenklatur: null,
        nama: "Bangunan pengaman Saluran",
        kode: "33.23.010306.0062.08002.2002",
        desa: null,
        kecamatan: null,
        bangunan_hulu: null,
        bangunan_hilir: null,
      },
      "bangunan_pengaman",
    );
    expect(r.map((x) => x.label)).not.toContain("Nomenklatur");
  });
});

describe("penandaKembar", () => {
  it("menandai nomenklatur yang dipakai bersama, walau nomor asetnya berbeda", () => {
    // D.I. Sandong punya 11 ruas bernomenklatur SAL.03783, sama ruasnya dan
    // sama desanya. Pembedanya hanya empat digit di tengah nomor aset, jadi
    // daftarnya menyesatkan kalau tidak ditandai.
    const daftar = Array.from({ length: 3 }, (_, i) => ({
      ...SALURAN_SIRANDU,
      id: 10 + i,
      nomenklatur: "SAL.03783",
      kode: `33.23.010306.0397.0200${8 + i}.2002`,
    }));

    const tanda = penandaKembar(daftar);
    expect(tanda.get(10)).toEqual({ urutan: 1, total: 3, takTerbedakan: false });
    expect(tanda.get(12)).toEqual({ urutan: 3, total: 3, takTerbedakan: false });
  });

  it("memberi tanda lebih keras bila nomor asetnya pun kembar", () => {
    const tanda = penandaKembar([
      { ...SALURAN_SIRANDU, id: 1 },
      { ...SALURAN_SIRANDU, id: 2 },
    ]);
    expect(tanda.get(1)?.takTerbedakan).toBe(true);
    expect(tanda.get(2)?.takTerbedakan).toBe(true);
  });

  it("mengelompokkan jenis tanpa nomenklatur lewat seluruh keping identitasnya", () => {
    // D.I. K. Pacar punya 8 bangunan pengaman tanpa nomenklatur dan tanpa desa.
    const kosong = {
      nomenklatur: null,
      nama: "Bangunan pengaman Saluran",
      desa: null,
      kecamatan: null,
      bangunan_hulu: null,
      bangunan_hilir: null,
    };
    // Nomor aset yang berbeda sudah cukup membedakan keduanya.
    expect(
      penandaKembar([
        { ...kosong, id: 1, kode: "33.23.010306.0062.08002.2002" },
        { ...kosong, id: 2, kode: "33.23.010306.0062.08003.2002" },
      ]).size,
    ).toBe(0);
    // Tanpa nomor aset pun, keduanya benar-benar tidak terbedakan.
    expect(
      penandaKembar([
        { ...kosong, id: 1, kode: null },
        { ...kosong, id: 2, kode: null },
      ]).get(1),
    ).toEqual({ urutan: 1, total: 2, takTerbedakan: true });
  });

  it("tidak menandai apa pun bila seluruh bangunan sudah unik", () => {
    const tanda = penandaKembar([
      { ...SALURAN_SIRANDU, id: 1 },
      { ...SALURAN_SIRANDU, id: 2, nomenklatur: "SAL.04023" },
    ]);
    expect(tanda.size).toBe(0);
  });
});

describe("namaDiBerbeda", () => {
  it("menganggap sama walau ejaan dan tanda bacanya beda", () => {
    expect(namaDiBerbeda("DI SIRANDU", "D.I. Sirandu")).toBe(false);
    expect(namaDiBerbeda("DI SI ENCES", "D.I. Siences")).toBe(false);
  });

  it("menganggap sama bila salah satunya sekadar penyebutan yang lebih panjang", () => {
    // Buku sering menambahkan nama kecamatan atau keterangan sumber air.
    expect(namaDiBerbeda("DI SEWIYU TEMANGGUNG", "D.I. Sewiyu")).toBe(false);
    expect(namaDiBerbeda("DI KRINCING", "D.I. Krincing (MA)")).toBe(false);
  });

  it("memergoki aset yang tertaut ke D.I. yang benar-benar lain", () => {
    // 176 aset bertuliskan "DI SILUMUT KARANGTEJO" di buku tertaut ke
    // D.I. Aji Bangkong, karena penautan dibuat dari kode, bukan dari nama.
    expect(namaDiBerbeda("DI SILUMUT KARANGTEJO", "D.I. Aji Bangkong")).toBe(true);
    expect(namaDiBerbeda("DI NDUREN", "D.I. Sandong")).toBe(true);
  });

  it("diam saja bila bukunya memang tidak mencatat nama D.I.", () => {
    expect(namaDiBerbeda(null, "D.I. Sirandu")).toBe(false);
  });
});

describe("terapkanGolongan", () => {
  it("membiarkan nomor bangunan apa adanya", () => {
    const kode = "33.23.010306.0538.01001.2002";
    expect(terapkanGolongan(kode, "bendung")).toBe(kode);
    expect(terapkanGolongan(kode, "saluran")).toBe(kode);
    expect(terapkanGolongan(kode, "bangunan_pengaman")).toBe(kode);
  });

  it("menjadikan seluruh aset tanah bergolongan 02", () => {
    // Buku menulis 010306 untuk semuanya, termasuk 1.615 aset tanah.
    const buku = "33.23.010306.0287.12001.2002";
    for (const jenis of [
      "tanah_saluran",
      "tanah_bangunan_saluran",
      "tanah_saluran_ma",
      "tanah_lambiran_sungai",
      "tanah_lambiran_saluran",
      "tanah_rumah",
      "tanah_tidak_tersedia_kib",
      "jalan_inspeksi",
    ] as const) {
      expect(terapkanGolongan(buku, jenis), jenis).toBe("33.23.020306.0287.12001.2002");
    }
  });

  it("hanya menyentuh segmen ke-3, tidak menyusun ulang nomornya", () => {
    // 13 nomor di buku segmen ke-4 dan ke-5-nya tertulis menyatu. Bagian itu
    // harus lewat apa adanya, supaya tetap terlihat sebagai perapian.
    expect(terapkanGolongan("33.23.010306.0010501001.2002", "tanah_bangunan_saluran")).toBe(
      "33.23.020306.0010501001.2002",
    );
  });

  it("aman dipanggil berulang", () => {
    const sekali = terapkanGolongan("33.23.010306.0287.12001.2002", "tanah_saluran");
    expect(terapkanGolongan(sekali, "tanah_saluran")).toBe(sekali);
  });

  it("tidak menyentuh nomor kosong atau yang kurang dari tiga ruas", () => {
    expect(terapkanGolongan(null, "tanah_saluran")).toBeNull();
    expect(terapkanGolongan("33.23", "tanah_saluran")).toBe("33.23");
  });
});

describe("terapkanWilayah & nomorAset", () => {
  const BUKU = "33.23.010306.0287.01001.2002";
  const DI_287_R1 = { uptId: 1, kodeDi: "33230287" };

  it("memasang 2 digit UPT di depan 3 digit nomor D.I.", () => {
    expect(terapkanWilayah(BUKU, DI_287_R1)).toBe("33.23.010306.01287.01001.2002");
    expect(terapkanWilayah(BUKU, { uptId: 2, kodeDi: "33230287" })).toBe(
      "33.23.010306.02287.01001.2002",
    );
    expect(terapkanWilayah(BUKU, { uptId: 3, kodeDi: "33230287" })).toBe(
      "33.23.010306.03287.01001.2002",
    );
  });

  it("membiarkan nomor aset yang belum tertaut D.I.", () => {
    // 193 aset belum punya D.I.; menebak UPT-nya justru menyembunyikan
    // pekerjaan perapian yang memang harus dilakukan petugas.
    expect(terapkanWilayah(BUKU, { uptId: null, kodeDi: null })).toBe(BUKU);
    expect(nomorAset(BUKU, "bendung", null)).toBe(BUKU);
  });

  it("membiarkan nomor yang segmen ke-4 dan ke-5-nya menyatu", () => {
    const menyatu = "33.23.010306.0010501001.2002";
    expect(terapkanWilayah(menyatu, DI_287_R1)).toBe(menyatu);
  });

  it("memasang golongan dan wilayah sekaligus", () => {
    expect(nomorAset(BUKU, "bendung", DI_287_R1)).toBe("33.23.010306.01287.01001.2002");
    expect(nomorAset("33.23.010306.0287.12001.2002", "tanah_saluran", DI_287_R1)).toBe(
      "33.23.020306.01287.12001.2002",
    );
  });

  it("aman dipanggil berulang", () => {
    const sekali = nomorAset(BUKU, "tanah_saluran", DI_287_R1);
    expect(nomorAset(sekali, "tanah_saluran", DI_287_R1)).toBe(sekali);
  });
});

describe("uraikanKode", () => {
  it("menguraikan nomor asli dari buku", () => {
    const u = uraikanKode("33.23.010306.0538.01001.2002");
    expect(u?.map((x) => x.segmen)).toEqual(["33", "23", "010306", "0538", "01001", "2002"]);
    expect(u?.[2].arti).toBe("Golongan bangunan irigasi");
    expect(u?.[3].arti).toBe("Kode Daerah Irigasi");
  });

  it("masih mengenali nomor bentukan sistem, supaya data lama tetap terbaca", () => {
    const u = uraikanKode("33.23.020306.02538.12001.2002");
    expect(u?.[2].arti).toBe("Golongan aset tanah");
    expect(u?.[3].arti).toBe("UPT Regional 2 · D.I. 538");
  });

  it("tidak mengarang UPT dari nomor buku yang salah ketik", () => {
    // 94 nomor di buku segmen ke-4-nya 5 digit karena salah ketik.
    expect(uraikanKode("33.23.010306.00172.01001.2002")?.[3].arti).toBe(
      "Kode Daerah Irigasi (tidak baku)",
    );
    expect(uraikanKode("33.23.010306.90000.01001.2002")?.[3].arti).toBe(
      "Kode Daerah Irigasi (tidak baku)",
    );
  });

  it("menolak nomor yang bukan 6 segmen", () => {
    expect(uraikanKode("33.23.010306")).toBeNull();
    expect(uraikanKode(null)).toBeNull();
  });
});
