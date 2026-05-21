import { NextResponse } from "next/server";

const REPO_OWNER = process.env.GITHUB_REPO_OWNER ?? "siksik-e0-0";
const REPO_NAME = process.env.GITHUB_REPO_NAME ?? "local-bites";
const BRANCH = process.env.GITHUB_BRANCH ?? "main";
const FILE_PATH = "share_link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AddPayload {
  url?: unknown;
  category?: unknown;
}

function isValidShortUrl(u: string): boolean {
  return /^https:\/\/(?:naver\.me|map\.naver\.com|m\.place\.naver\.com)\//i.test(u);
}

export async function POST(req: Request) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error: "서버 설정 누락: GITHUB_TOKEN 환경 변수가 Vercel 에 설정되지 않았습니다.",
      },
      { status: 500 },
    );
  }

  let body: AddPayload;
  try {
    body = (await req.json()) as AddPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 JSON" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const category =
    body.category === "식당" || body.category === "카페" || body.category === "기타"
      ? body.category
      : null;

  if (!url || !isValidShortUrl(url)) {
    return NextResponse.json(
      { ok: false, error: "유효한 Naver 지도 단축 URL 이 아닙니다." },
      { status: 400 },
    );
  }

  const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(BRANCH)}`, {
    headers,
    cache: "no-store",
  });
  if (!getRes.ok) {
    return NextResponse.json(
      { ok: false, error: `share_link 읽기 실패 (${getRes.status})` },
      { status: 502 },
    );
  }
  const getJson = (await getRes.json()) as { content?: string; sha?: string };
  const currentRaw = getJson.content
    ? Buffer.from(getJson.content, "base64").toString("utf8")
    : "";

  const existingLines = currentRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const alreadyExists = existingLines.some((l) => l.split("|")[0].trim() === url);
  if (alreadyExists) {
    return NextResponse.json(
      { ok: true, added: false, message: "이미 등록된 URL 입니다." },
      { status: 200 },
    );
  }

  const newLine = category ? `${url} | ${category}` : url;
  const trimmedEnd = currentRaw.replace(/\s+$/g, "");
  const nextContent = `${trimmedEnd}${trimmedEnd ? "\n" : ""}${newLine}\n`;

  const putRes = await fetch(apiBase, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `chore(share_link): add ${url}`,
      content: Buffer.from(nextContent, "utf8").toString("base64"),
      sha: getJson.sha,
      branch: BRANCH,
    }),
  });

  if (!putRes.ok) {
    const errText = await putRes.text().catch(() => "");
    return NextResponse.json(
      { ok: false, error: `share_link 쓰기 실패 (${putRes.status}) ${errText.slice(0, 120)}` },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    added: true,
    message: "추가 완료. 잠시 후 자동 빌드되어 카드가 나타납니다.",
  });
}
