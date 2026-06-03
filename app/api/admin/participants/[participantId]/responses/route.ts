import { isAdminRequest, unauthorizedJson } from "@/lib/admin";
import { connect, deleteParticipantResponses } from "@/lib/storage";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, context: { params: Promise<{ participantId: string }> }) {
  if (!isAdminRequest(request)) {
    return unauthorizedJson();
  }
  const params = await context.params;
  const participantId = decodeURIComponent(params.participantId).trim();
  if (!participantId) {
    return Response.json({ error: "Invalid participant id." }, { status: 400 });
  }
  return Response.json({ deleted: deleteParticipantResponses(connect(), participantId) });
}
