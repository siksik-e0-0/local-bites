import { NextResponse } from "next/server";
import { supabase, createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, unknown> = {
    env_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING",
    env_anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "MISSING",
    env_svc: process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING",
  };

  try {
    const { data, error, count } = await supabase
      .from("lb_places")
      .select("id", { count: "exact" })
      .limit(1);
    results.anon_query = { count, error: error?.message, has_data: !!data };
  } catch (e) {
    results.anon_error = (e as Error).message;
  }

  try {
    const sb = createAdminClient();
    const { data, error, count } = await sb
      .from("lb_places")
      .select("id", { count: "exact" })
      .limit(1);
    results.admin_query = { count, error: error?.message, has_data: !!data };
  } catch (e) {
    results.admin_error = (e as Error).message;
  }

  return NextResponse.json(results);
}
