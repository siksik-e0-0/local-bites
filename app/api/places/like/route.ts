import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  id?: unknown;
  delta?: unknown;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const delta = body.delta === 1 ? 1 : body.delta === -1 ? -1 : 0;
  if (!id || delta === 0) {
    return NextResponse.json(
      { ok: false, error: "id 와 delta(+1|-1) 가 필요합니다." },
      { status: 400 },
    );
  }

  const sb = createAdminClient();
  const { data, error } = await sb.rpc("lb_toggle_like", {
    p_place_id: id,
    p_delta: delta,
  });

  if (error) {
    console.error("[like] lb_toggle_like error:", error.message);
    return NextResponse.json({ ok: false, error: "좋아요 처리 실패" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, count: data as number });
}
