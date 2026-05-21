import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      {
        ok: false,
        error: "서버 설정 누락: ADMIN_PASSWORD 환경 변수가 Vercel 에 설정되지 않았습니다.",
      },
      { status: 500 },
    );
  }

  let body: { password?: unknown } = {};
  try {
    body = (await req.json()) as { password?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 JSON" }, { status: 400 });
  }

  const pw = typeof body.password === "string" ? body.password : "";
  if (pw !== expected) {
    return NextResponse.json({ ok: false, error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
