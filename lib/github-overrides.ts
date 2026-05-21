import type { OverridesFile, PlaceOverride } from "./types";

const REPO_OWNER = process.env.GITHUB_REPO_OWNER ?? "siksik-e0-0";
const REPO_NAME = process.env.GITHUB_REPO_NAME ?? "local-bites";
const BRANCH = process.env.GITHUB_BRANCH ?? "main";
const OVERRIDES_PATH = "data/places.overrides.json";
const SHARE_LINK_PATH = "share_link";

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function getFile(
  token: string,
  path: string,
): Promise<{ ok: true; text: string; sha: string } | { ok: false; status: number; error: string }> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`;
  const res = await fetch(url, { headers: ghHeaders(token), cache: "no-store" });
  if (res.status === 404) {
    return { ok: true, text: "", sha: "" };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, error: `GitHub GET ${path} 실패 (${res.status})` };
  }
  const json = (await res.json()) as { content?: string; sha?: string };
  const text = json.content ? Buffer.from(json.content, "base64").toString("utf8") : "";
  return { ok: true, text, sha: json.sha ?? "" };
}

async function putFile(
  token: string,
  path: string,
  content: string,
  sha: string,
  message: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...ghHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      sha: sha || undefined,
      branch: BRANCH,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: `GitHub PUT ${path} 실패 (${res.status}) ${txt.slice(0, 160)}` };
  }
  return { ok: true };
}

function parseOverrides(text: string): OverridesFile {
  if (!text.trim()) return { version: 1, overrides: {} };
  try {
    const parsed = JSON.parse(text) as Partial<OverridesFile>;
    return {
      version: parsed.version ?? 1,
      overrides: parsed.overrides ?? {},
    };
  } catch {
    return { version: 1, overrides: {} };
  }
}

export async function mutateOverrides(
  token: string,
  placeId: string,
  patch: Partial<PlaceOverride>,
  commitMessage: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const got = await getFile(token, OVERRIDES_PATH);
  if (!got.ok) return got;

  const file = parseOverrides(got.text);
  const existing = file.overrides[placeId] ?? {};
  const next: PlaceOverride = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  file.overrides[placeId] = next;

  const serialized = JSON.stringify(file, null, 2) + "\n";
  return putFile(token, OVERRIDES_PATH, serialized, got.sha, commitMessage);
}

export async function removeFromShareLink(
  token: string,
  shortUrl: string,
): Promise<{ ok: true; removed: boolean } | { ok: false; status: number; error: string }> {
  const got = await getFile(token, SHARE_LINK_PATH);
  if (!got.ok) return got;

  const lines = got.text.split(/\r?\n/);
  const target = shortUrl.trim();
  let removed = false;
  const filtered = lines.filter((l) => {
    const url = l.split("|")[0].trim();
    if (url === target) {
      removed = true;
      return false;
    }
    return true;
  });

  if (!removed) return { ok: true, removed: false };

  const nextContent = filtered.join("\n").replace(/\n+$/g, "") + "\n";
  const put = await putFile(token, SHARE_LINK_PATH, nextContent, got.sha, `chore(share_link): remove ${target}`);
  if (!put.ok) return put;
  return { ok: true, removed: true };
}
