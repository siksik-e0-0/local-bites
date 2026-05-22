import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AddBody {
  id?: unknown;
  author?: unknown;
  text?: unknown;
}

interface DelBody {
  id?: unknown;
  commentId?: unknown;
}

export async function POST(req: Request) {
  let body: AddBody;
  try {
    body = (await req.json()) as AddBody;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const author =
    (typeof body.author === "string" ? body.author.trim() : "").slice(0, 24) || "익명";
  const text = (typeof body.text === "string" ? body.text.trim() : "").slice(0, 500);

  if (!id) {
    return NextResponse.json({ ok: false, error: "id 가 필요합니다." }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ ok: false, error: "댓글 내용이 비었습니다." }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("lb_place_comments")
    .insert({ place_id: id, author, body: text })
    .select("id, author, body, created_at")
    .single();

  if (error) {
    console.error("[comment] insert error:", error.message);
    return NextResponse.json({ ok: false, error: "댓글 저장 실패" }, { status: 502 });
  }

  // Return in the shape the frontend expects
  const comment = {
    id: data.id,
    author: data.author,
    text: data.body,
    createdAt: data.created_at,
  };
  return NextResponse.json({ ok: true, comment });
}

export async function DELETE(req: Request) {
  const auth = verifyAdminRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: DelBody;
  try {
    body = (await req.json()) as DelBody;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const commentId = typeof body.commentId === "string" ? body.commentId.trim() : "";
  if (!id || !commentId) {
    return NextResponse.json(
      { ok: false, error: "id, commentId 가 필요합니다." },
      { status: 400 },
    );
  }

  const sb = createAdminClient();
  const { count, error } = await sb
    .from("lb_place_comments")
    .delete({ count: "exact" })
    .eq("id", commentId)
    .eq("place_id", id);

  if (error) {
    console.error("[comment] delete error:", error.message);
    return NextResponse.json({ ok: false, error: "댓글 삭제 실패" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, removed: (count ?? 0) > 0 });
}
