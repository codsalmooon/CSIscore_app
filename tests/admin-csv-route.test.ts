import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/storage", () => ({
  connect: vi.fn(() => ({})),
  participantScoresCsv: vi.fn(() => "scores"),
  rawDataCsv: vi.fn(() => "raw"),
}));

import { GET } from "@/app/api/admin/csv/[kind]/route";

function adminRequest() {
  return new Request("http://localhost/api/admin/csv/raw", {
    headers: { "X-CSI-Admin-Passcode": "csi-admin" },
  }) as NextRequest;
}

describe("admin csv route", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T06:30:45.000Z"));
  });

  test("raw csv uses factor-scores filename", async () => {
    const response = await GET(adminRequest(), { params: Promise.resolve({ kind: "raw" }) });

    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="csi_factor-scores_20260611-153045.csv"',
    );
  });

  test("participant score csv uses total-scores filename", async () => {
    const response = await GET(adminRequest(), { params: Promise.resolve({ kind: "scores" }) });

    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="csi_total-scores_20260611-153045.csv"',
    );
  });
});
