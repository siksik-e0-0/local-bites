export function verifyAdminRequest(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return {
      ok: false,
      status: 500,
      error: "서버 설정 누락: ADMIN_PASSWORD 환경 변수가 설정되지 않았습니다.",
    };
  }
  const header = req.headers.get("x-admin-token") ?? "";
  if (header !== expected) {
    return { ok: false, status: 401, error: "관리자 인증 실패." };
  }
  return { ok: true };
}
