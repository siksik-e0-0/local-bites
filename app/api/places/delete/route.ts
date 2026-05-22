import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase";
import { removeFromShareLink } from "@/lib/github-overrides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DeleteBody {
  id?: unknown;
  shortUrl?: unknown;
}

export async function POST(req: Request) {
  const auth = verifyAdminRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: DeleteBody;
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const shortUrl = typeof body.shortUrl === "string" ? body.shortUrl.trim() : "";
  if (!id) {
    return NextResponse.json({ ok: false, error: "id 가 필요합니다." }, { status: 400 });
  }

  const sb = createAdminClient();
  const { error } = await sb.from("lb_places").delete().eq("id", id);
  if (error) {
    console.error("[delete] lb_places delete error:", error.message);
    return NextResponse.json({ ok: false, error: "삭제 실패" }, { status: 502 });
  }

  // Also remove from share_link so GHA doesn't re-add it
  let shareLinkRemoved = false;
  if (shortUrl) {
    const token = process.env.GITHUB_TOKEN;
    if (token) {
      const slRes = await removeFromShareLink(token, shortUrl);
      if (slRes.ok) shareLinkRemoved = slRes.removed;
    }
  }

  return NextResponse.json({
    ok: true,
    shareLinkRemoved,
    message: shareLinkRemoved ? "삭제 완료. share_link 에서도 제거되었습니다." : "삭제 완료.",
  });
}
