import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "./types";

/** Klien Supabase untuk Server Component / Route Handler / Server Action. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Dipanggil dari Server Component — penyegaran sesi sudah
            // ditangani middleware, jadi aman diabaikan.
          }
        },
      },
    },
  );
}
