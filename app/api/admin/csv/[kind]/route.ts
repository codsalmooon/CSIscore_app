import { isAdminRequest, unauthorizedJson } from "@/lib/admin";
import {
  connect,
  participantScoresCsv,
  rawDataCsv,
} from "@/lib/storage";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const TOKYO_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-CA-u-nu-latn", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function tokyoTimestamp(date = new Date()): string {
  const parts = Object.fromEntries(
    TOKYO_TIMESTAMP_FORMATTER.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
}

function csvFilename(prefix: string, date = new Date()): string {
  return `${prefix}_${tokyoTimestamp(date)}.csv`;
}

const CSV_HANDLERS = {
  raw: { filenamePrefix: "csi_factor-scores", create: rawDataCsv },
  scores: { filenamePrefix: "csi_total-scores", create: participantScoresCsv },
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
      "Content-Disposition": `attachment; filename="${csvFilename(handler.filenamePrefix)}"`,
    },
  });
}
