import { calculateScores, Factor, isFactor } from "@/lib/csi";
import { connect, saveResponse } from "@/lib/storage";

export const dynamic = "force-dynamic";

type ResponsePayload = {
  participantId?: unknown;
  conditionId?: unknown;
  itemScores?: unknown;
  pairChoices?: unknown;
  pairOrder?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ResponsePayload;
    if (typeof body.participantId !== "string" || !body.participantId.trim()) {
      return Response.json({ error: "participantId is required." }, { status: 400 });
    }
    const conditionId = Number(body.conditionId);
    if (!Number.isInteger(conditionId)) {
      return Response.json({ error: "conditionId is required." }, { status: 400 });
    }
    if (typeof body.itemScores !== "object" || body.itemScores == null || Array.isArray(body.itemScores)) {
      return Response.json({ error: "itemScores is required." }, { status: 400 });
    }
    if (!Array.isArray(body.pairChoices) || !body.pairChoices.every(isFactor)) {
      return Response.json({ error: "pairChoices is invalid." }, { status: 400 });
    }
    if (!Array.isArray(body.pairOrder) || !body.pairOrder.every((value) => Number.isInteger(Number(value)))) {
      return Response.json({ error: "pairOrder is invalid." }, { status: 400 });
    }

    const itemScores = body.itemScores as Record<string, number>;
    const pairChoices = body.pairChoices as Factor[];
    const pairOrder = body.pairOrder.map(Number);
    const scores = calculateScores(itemScores, pairChoices, pairOrder);
    const responseId = saveResponse(
      connect(),
      body.participantId,
      conditionId,
      itemScores,
      pairChoices,
      scores,
      pairOrder,
    );

    return Response.json({ responseId, scores });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "回答の保存に失敗しました。" },
      { status: 400 },
    );
  }
}
