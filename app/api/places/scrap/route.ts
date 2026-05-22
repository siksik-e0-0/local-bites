import { NextResponse } from "next/server";
import { toggleScrap } from "@/lib/github-overrides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  id?: unknown;
  on?: unknown;
}

export async function POST(req: Request) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "서버 설정 누락: GITHUB_TOKEN" },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const on = body.on === true;
  if (!id) {
    return NextResponse.json({ ok: false, error: "id 가 필요합니다." }, { status: 400 });
  }

  const res = await toggleScrap(token, id, on);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, scrappedIds: res.scrappedIds });
}
