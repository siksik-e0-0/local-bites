import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { mutateOverrides, removeFromShareLink } from "@/lib/github-overrides";

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

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "서버 설정 누락: GITHUB_TOKEN 환경 변수가 설정되지 않았습니다." },
      { status: 500 },
    );
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

  const ovRes = await mutateOverrides(
    token,
    id,
    { deleted: true },
    `chore(overrides): delete ${id}`,
  );
  if (!ovRes.ok) {
    return NextResponse.json({ ok: false, error: ovRes.error }, { status: 502 });
  }

  let shareLinkRemoved = false;
  if (shortUrl) {
    const slRes = await removeFromShareLink(token, shortUrl);
    if (slRes.ok) {
      shareLinkRemoved = slRes.removed;
    }
  }

  return NextResponse.json({
    ok: true,
    shareLinkRemoved,
    message: shareLinkRemoved
      ? "삭제 완료. share_link 에서도 제거되었습니다."
      : "삭제 완료.",
  });
}
