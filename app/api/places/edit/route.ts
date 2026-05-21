import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { mutateOverrides } from "@/lib/github-overrides";
import type { Category, PlaceEditPayload, PlaceOverride } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CATS: Category[] = ["식당", "카페", "기타"];

interface EditBody {
  id?: unknown;
  patch?: unknown;
}

function sanitizePatch(raw: unknown): PlaceEditPayload | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "patch 필드가 필요합니다." };
  const obj = raw as Record<string, unknown>;
  const out: PlaceEditPayload = {};

  if ("tags" in obj) {
    if (!Array.isArray(obj.tags)) return { error: "tags 는 배열이어야 합니다." };
    const tags = obj.tags
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);
    out.tags = Array.from(new Set(tags));
  }

  if ("description" in obj) {
    if (obj.description === null) {
      out.description = null;
    } else if (typeof obj.description === "string") {
      const d = obj.description.trim();
      out.description = d ? d.slice(0, 500) : null;
    } else {
      return { error: "description 은 문자열 또는 null 이어야 합니다." };
    }
  }

  if ("category" in obj) {
    if (typeof obj.category !== "string" || !VALID_CATS.includes(obj.category as Category)) {
      return { error: "category 는 식당|카페|기타 중 하나여야 합니다." };
    }
    out.category = obj.category as Category;
  }

  if ("name" in obj) {
    if (typeof obj.name !== "string") return { error: "name 은 문자열이어야 합니다." };
    const n = obj.name.trim();
    if (!n) return { error: "name 은 비어있을 수 없습니다." };
    out.name = n.slice(0, 80);
  }

  if ("images" in obj) {
    if (!Array.isArray(obj.images)) return { error: "images 는 배열이어야 합니다." };
    const urls = obj.images
      .filter((u): u is string => typeof u === "string")
      .map((u) => u.trim())
      .filter((u) => /^(https?:\/\/|\/uploads\/)/i.test(u))
      .slice(0, 12);
    out.images = Array.from(new Set(urls));
  }

  if (Object.keys(out).length === 0) return { error: "수정할 필드가 없습니다." };
  return out;
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

  let body: EditBody;
  try {
    body = (await req.json()) as EditBody;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ ok: false, error: "id 가 필요합니다." }, { status: 400 });
  }

  const sanitized = sanitizePatch(body.patch);
  if ("error" in sanitized) {
    return NextResponse.json({ ok: false, error: sanitized.error }, { status: 400 });
  }

  const patch: Partial<PlaceOverride> = { ...sanitized };
  const result = await mutateOverrides(token, id, patch, `chore(overrides): edit ${id}`);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, message: "수정 완료. 잠시 후 새 빌드가 반영됩니다." });
}
