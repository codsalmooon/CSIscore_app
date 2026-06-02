import { connect, listExperimentConditions } from "@/lib/storage";

export const dynamic = "force-dynamic";

export function GET() {
  const conn = connect();
  return Response.json({ conditions: listExperimentConditions(conn) });
}
