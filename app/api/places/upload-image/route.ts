import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPO_OWNER = process.env.GITHUB_REPO_OWNER ?? "siksik-e0-0";
const REPO_NAME = process.env.GITHUB_REPO_NAME ?? "local-bites";
const BRANCH = process.env.GITHUB_BRANCH ?? "main";

const MAX_BYTES = 1_500_000;

const EXT_BY_MIME: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
};

interface UploadBody {
  id?: unknown;
  dataUrl?: unknown;
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const m = dataUrl.match(/^data:([\w/+\-.]+);base64,(.+)$/);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  if (!EXT_BY_MIME[mime]) return null;
  try {
    return { mime, buffer: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
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

  let body: UploadBody;
  try {
    body = (await req.json()) as UploadBody;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? sanitizeId(body.id) : "";
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
  if (!id) return NextResponse.json({ ok: false, error: "id 가 필요합니다." }, { status: 400 });
  if (!dataUrl) return NextResponse.json({ ok: false, error: "dataUrl 이 필요합니다." }, { status: 400 });

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    return NextResponse.json(
      { ok: false, error: "지원하지 않는 이미지 형식입니다 (webp/jpg/png/gif)." },
      { status: 400 },
    );
  }
  if (parsed.buffer.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: `이미지가 너무 큽니다 (${(parsed.buffer.byteLength / 1024).toFixed(0)}KB > ${MAX_BYTES / 1024}KB).` },
      { status: 413 },
    );
  }

  const ext = EXT_BY_MIME[parsed.mime];
  const fname = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const repoPath = `public/uploads/${id}/${fname}`;

  const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${repoPath}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };

  const putRes = await fetch(apiBase, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `chore(uploads): add image for ${id}`,
      content: parsed.buffer.toString("base64"),
      branch: BRANCH,
    }),
  });

  if (!putRes.ok) {
    const txt = await putRes.text().catch(() => "");
    return NextResponse.json(
      { ok: false, error: `GitHub 업로드 실패 (${putRes.status}) ${txt.slice(0, 160)}` },
      { status: 502 },
    );
  }

  const url = `/uploads/${id}/${fname}`;
  return NextResponse.json({ ok: true, url });
}
