import { isAdminRequest, unauthorizedJson } from "@/lib/admin";
import { connect, deleteResponse } from "@/lib/storage";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) {
    return unauthorizedJson();
  }
  const params = await context.params;
  const responseId = Number(params.id);
  if (!Number.isInteger(responseId)) {
    return Response.json({ error: "Invalid response id." }, { status: 400 });
  }
  return Response.json({ deleted: deleteResponse(connect(), responseId) });
}
