export const ADMIN_TOKEN_KEY = "lb:admin_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

export async function verifyAdminPassword(password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) return { ok: false, error: data.error ?? "인증 실패" };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `네트워크 오류: ${(err as Error).message}` };
  }
}
