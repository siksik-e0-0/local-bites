import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  id?: unknown;
  on?: unknown;
  sessionId?: unknown;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const on = body.on === true;
  // sessionId from client localStorage (UUID). Falls back to "anonymous" until §7-5 frontend update.
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim()
      ? body.sessionId.trim().slice(0, 64)
      : "anonymous";

  if (!id) {
    return NextResponse.json({ ok: false, error: "id 가 필요합니다." }, { status: 400 });
  }

  const sb = createAdminClient();

  if (on) {
    await sb
      .from("lb_user_scraps")
      .upsert({ session_id: sessionId, place_id: id }, { onConflict: "session_id,place_id", ignoreDuplicates: true });
  } else {
    await sb
      .from("lb_user_scraps")
      .delete()
      .eq("session_id", sessionId)
      .eq("place_id", id);
  }

  // Return all scrapped place_ids for this session (backwards-compatible shape)
  const { data } = await sb
    .from("lb_user_scraps")
    .select("place_id")
    .eq("session_id", sessionId);

  const scrappedIds = (data ?? []).map((r) => r.place_id);
  return NextResponse.json({ ok: true, scrappedIds });
}
