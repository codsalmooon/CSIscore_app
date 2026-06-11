import { connect, incompleteParticipantSummaries } from "@/lib/storage";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ participants: incompleteParticipantSummaries(connect()) });
}
