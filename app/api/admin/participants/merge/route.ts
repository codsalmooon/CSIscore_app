import { isAdminRequest, unauthorizedJson } from "@/lib/admin";
import { connect, mergeParticipantResponses } from "@/lib/storage";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type MergePayload = {
  sourceParticipantId?: unknown;
  targetParticipantId?: unknown;
};

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedJson();
  }
  const body = (await request.json()) as MergePayload;
  const sourceParticipantId = typeof body.sourceParticipantId === "string" ? body.sourceParticipantId.trim() : "";
  const targetParticipantId = typeof body.targetParticipantId === "string" ? body.targetParticipantId.trim() : "";
  if (!sourceParticipantId || !targetParticipantId) {
    return Response.json({ error: "統合元IDと統合先IDを入力してください。" }, { status: 400 });
  }
  if (sourceParticipantId === targetParticipantId) {
    return Response.json({ error: "統合元IDと統合先IDは別のIDを指定してください。" }, { status: 400 });
  }
  return Response.json({ updated: mergeParticipantResponses(connect(), sourceParticipantId, targetParticipantId) });
}
