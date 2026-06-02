import { isAdminRequest, unauthorizedJson } from "@/lib/admin";
import {
  conditionSummary,
  connect,
  factorSummary,
  listExperimentConditions,
  participantCompletionSummary,
} from "@/lib/storage";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedJson();
  }
  const conn = connect();
  return Response.json({
    conditions: listExperimentConditions(conn),
    participantCompletion: participantCompletionSummary(conn),
    conditionSummary: conditionSummary(conn),
    factorSummary: factorSummary(conn),
  });
}
