import { isAdminRequest, unauthorizedJson } from "@/lib/admin";
import {
  connect,
  participantScoresCsv,
  rawDataCsv,
} from "@/lib/storage";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const CSV_HANDLERS = {
  raw: { filename: "csi_raw_data.csv", create: rawDataCsv },
  scores: { filename: "csi_participant_scores.csv", create: participantScoresCsv },
} as const;

export async function GET(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  if (!isAdminRequest(request)) {
    return unauthorizedJson();
  }
  const params = await context.params;
  const handler = CSV_HANDLERS[params.kind as keyof typeof CSV_HANDLERS];
  if (!handler) {
    return Response.json({ error: "Unknown CSV kind." }, { status: 404 });
  }
  return new Response(handler.create(connect()), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${handler.filename}"`,
    },
  });
}
