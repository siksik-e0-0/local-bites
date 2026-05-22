import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Supabase 환경변수 미설정: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 확인",
  );
}

/** 브라우저/서버 공통 read-only 클라이언트 (anon key) */
export const supabase = createClient(url, anonKey, {
  global: {
    // Next.js App Router fetch 캐시 우회 (force-dynamic 페이지용)
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
  },
});

/**
 * 서버 전용 admin 클라이언트 (service_role key).
 * Next.js Server Component / API Route에서만 호출할 것.
 * 절대 클라이언트 사이드 번들에 포함되지 않도록 주의.
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경변수 미설정 (서버 전용)");
  }
  return createClient(url!, serviceKey, {
    auth: { persistSession: false },
  });
}
