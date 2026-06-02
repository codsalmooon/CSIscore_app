import { NextRequest } from "next/server";

export const ADMIN_PASSCODE = process.env.CSI_ADMIN_PASSCODE ?? "csi-admin";

export function isAdminRequest(request: NextRequest): boolean {
  return request.headers.get("X-CSI-Admin-Passcode") === ADMIN_PASSCODE;
}

export function unauthorizedJson(): Response {
  return Response.json({ error: "パスコードが正しくありません。" }, { status: 401 });
}
