import { isAdminRequest, unauthorizedJson } from "@/lib/admin";
import { connect, responseRows } from "@/lib/storage";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedJson();
  }
  return Response.json({ responses: responseRows(connect()) });
}
