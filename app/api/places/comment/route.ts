import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { addComment, deleteComment } from "@/lib/github-overrides";
import type { PlaceComment } from "@/lib/types";

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
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "서버 설정 누락: GITHUB_TOKEN" },
      { status: 500 },
    );
  }

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

  const comment: PlaceComment = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    author,
    text,
    createdAt: new Date().toISOString(),
  };
  const res = await addComment(token, id, comment);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, comment });
}

export async function DELETE(req: Request) {
  const auth = verifyAdminRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "서버 설정 누락: GITHUB_TOKEN" },
      { status: 500 },
    );
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

  const res = await deleteComment(token, id, commentId);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, removed: res.removed });
}
