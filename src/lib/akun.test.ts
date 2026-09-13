import { describe, expect, it } from "vitest";

import {
  DOMAIN_AKUN,
  POLA_USERNAME,
  emailDariUsername,
  normalkanUsername,
  usernameDariEmail,
  usernameValid,
} from "./akun";

describe("normalkanUsername", () => {
  it("merapikan spasi dan huruf besar", () => {
    expect(normalkanUsername("  Ngadirejo  ")).toBe("ngadirejo");
    expect(normalkanUsername("ADMIN")).toBe("admin");
  });
});

describe("usernameValid", () => {
  it.each(["admin", "ngadirejo", "upt.parakan", "budi_santoso", "petugas-01", "abc", "a1b"])(
    "menerima %s",
    (u) => {
      expect(usernameValid(u)).toBe(true);
    },
  );

  it.each([
    ["ab", "terlalu pendek"],
    ["", "kosong"],
    [".admin", "diawali titik"],
    ["-admin", "diawali strip"],
    ["admin budi", "mengandung spasi"],
    ["admin@go.id", "mengandung @"],
    ["admin/upt", "mengandung garis miring"],
    ["a".repeat(33), "lebih dari 32 karakter"],
  ])("menolak %s (%s)", (u) => {
    expect(usernameValid(u)).toBe(false);
  });

  it("menerima input berhuruf besar karena dinormalkan dulu", () => {
    expect(usernameValid("Ngadirejo")).toBe(true);
    // Namun pola mentahnya sendiri hanya menerima huruf kecil, sama seperti
    // constraint profil_username_format di database.
    expect(POLA_USERNAME.test("Ngadirejo")).toBe(false);
  });

  it("menerima tepat 32 karakter, menolak 33", () => {
    expect(usernameValid("a".repeat(32))).toBe(true);
    expect(usernameValid("a".repeat(33))).toBe(false);
  });
});

describe("pemetaan username <-> email", () => {
  it("menurunkan email dari username", () => {
    expect(emailDariUsername("ngadirejo")).toBe(`ngadirejo@${DOMAIN_AKUN}`);
    expect(emailDariUsername("  ADMIN ")).toBe(`admin@${DOMAIN_AKUN}`);
  });

  it("mengembalikan username dari email", () => {
    expect(usernameDariEmail(`ngadirejo@${DOMAIN_AKUN}`)).toBe("ngadirejo");
    expect(usernameDariEmail("ADMIN@Contoh.Go.Id")).toBe("admin");
  });

  it("bolak-balik konsisten", () => {
    for (const u of ["admin", "ngadirejo", "upt.parakan", "petugas-01"]) {
      expect(usernameDariEmail(emailDariUsername(u))).toBe(u);
    }
  });
});
