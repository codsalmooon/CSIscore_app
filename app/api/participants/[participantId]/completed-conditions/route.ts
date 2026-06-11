import { completedConditionIdsForParticipant, connect } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ participantId: string }> }) {
  const params = await context.params;
  const participantId = decodeURIComponent(params.participantId).trim();
  if (!participantId) {
    return Response.json({ error: "Invalid participant id." }, { status: 400 });
  }
  return Response.json({ completedConditionIds: completedConditionIdsForParticipant(connect(), participantId) });
}
