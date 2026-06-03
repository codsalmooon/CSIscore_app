import { DatabaseSync } from "node:sqlite";
import { describe, expect, test } from "vitest";
import {
  FACTORS,
  ITEMS,
  PAIR_COMPARISONS,
  SCOREABLE_ITEMS,
  calculateScores,
  isParticipantId,
  newParticipantId,
} from "@/lib/csi";
import {
  EXPERIMENT_CONDITION_NAMES,
  deleteCondition,
  deleteParticipantResponses,
  deleteResponse,
  initDb,
  itemDataCsv,
  listExperimentConditions,
  pairDataCsv,
  participantScoresCsv,
  participantCompletionSummary,
  rawDataCsv,
  responseRows,
  saveResponse,
} from "@/lib/storage";

function memoryDb() {
  const conn = new DatabaseSync(":memory:");
  initDb(conn);
  return conn;
}

function defaultItemScores(value = 5) {
  return Object.fromEntries(SCOREABLE_ITEMS.map((item) => [item.id, value]));
}

describe("CSI scoring", () => {
  test("creates four-character alphanumeric participant ids", () => {
    const participantId = newParticipantId();

    expect(participantId).toMatch(/^[A-Z0-9]{4}$/);
    expect(isParticipantId("AB12")).toBe(true);
    expect(isParticipantId("P-AB12")).toBe(false);
    expect(isParticipantId("P-12345678")).toBe(false);
  });

  test("item definitions mark scoreable items", () => {
    expect(ITEMS).toHaveLength(12);
    expect(SCOREABLE_ITEMS).toHaveLength(10);
    expect(ITEMS.filter((item) => !item.scoreable).map((item) => item.id)).toEqual([
      "collaboration_1",
      "collaboration_2",
    ]);
  });

  test("calculates manual scores", () => {
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    const scores = calculateScores(itemScores, pairChoices);

    expect(PAIR_COMPARISONS).toHaveLength(15);
    expect(scores.factorScores.Enjoyment).toBe(10);
    expect(scores.factorCounts.Enjoyment).toBe(5);
    expect(scores.factorCounts.Collaboration).toBe(0);
    expect(scores.factorScores.Collaboration).toBe(0);
    expect(scores.csiScore).toBe(50);
  });

  test("collaboration is counted in pair comparisons", () => {
    const pairChoices = PAIR_COMPARISONS.map((pair) => (pair.includes("Collaboration") ? "Collaboration" : pair[0]));
    const scores = calculateScores(defaultItemScores(), pairChoices);

    expect(scores.factorCounts.Collaboration).toBe(5);
    expect(scores.factorScores.Collaboration).toBe(0);
    expect(scores.weightedScores.Collaboration).toBe(0);
  });

  test("max score is 100 when collaboration is never selected", () => {
    const scores = calculateScores(
      defaultItemScores(10),
      PAIR_COMPARISONS.map((pair) => pair[0]),
    );

    expect(scores.csiScore).toBe(100);
  });

  test("rejects invalid pair choices and pair order", () => {
    expect(() => calculateScores(defaultItemScores(), PAIR_COMPARISONS.slice(0, -1).map((pair) => pair[0]))).toThrow();
    const invalidOrder = Array.from({ length: PAIR_COMPARISONS.length }, (_, index) => index);
    invalidOrder[invalidOrder.length - 1] = invalidOrder[0];
    expect(() =>
      calculateScores(
        defaultItemScores(),
        PAIR_COMPARISONS.map((pair) => pair[0]),
        invalidOrder,
      ),
    ).toThrow();
  });

  test("calculates scores with shuffled pair order", () => {
    const pairOrder = Array.from({ length: PAIR_COMPARISONS.length }, (_, index) => index).reverse();
    const pairChoices = pairOrder.map((originalIndex) => PAIR_COMPARISONS[originalIndex][1]);
    const scores = calculateScores(defaultItemScores(), pairChoices, pairOrder);
    const expectedCounts = Object.fromEntries(FACTORS.map((factor) => [factor, 0]));
    for (const originalIndex of pairOrder) {
      expectedCounts[PAIR_COMPARISONS[originalIndex][1]] += 1;
    }
    expect(scores.factorCounts).toEqual(expectedCounts);
  });
});

describe("CSI storage and CSV", () => {
  test("response schema does not store collaboration status", () => {
    const conn = memoryDb();
    const columns = conn.prepare("PRAGMA table_info(responses)").all().map((row) => (row as { name: string }).name);
    expect(columns).not.toContain("collaboration_status");
    conn.close();
  });

  test("experiment conditions are created in fixed order", () => {
    const conn = memoryDb();
    expect(listExperimentConditions(conn).map((row) => row.name)).toEqual([...EXPERIMENT_CONDITION_NAMES]);
    conn.close();
  });

  test("repeated responses are saved as separate rows", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    const scores = calculateScores(itemScores, pairChoices);

    saveResponse(conn, "P-TEST", 1, itemScores, pairChoices, scores);
    saveResponse(conn, "P-TEST", 1, itemScores, pairChoices, scores);

    expect(responseRows(conn)).toHaveLength(2);
    conn.close();
  });

  test("csv uses N/A for inactive collaboration items", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    saveResponse(conn, "P-TEST", 1, itemScores, pairChoices, calculateScores(itemScores, pairChoices));

    const rawCsv = rawDataCsv(conn);
    const itemCsv = itemDataCsv(conn);

    expect(rawCsv).not.toContain("collaboration_status");
    expect(rawCsv).toContain("N/A");
    expect(itemCsv).toContain("collaboration_1");
    expect(itemCsv).toContain("collaboration_2");
    conn.close();
  });

  test("pair csv handles legacy 10 pair rows", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.slice(0, 10).map((pair) => pair[0]);
    saveResponse(conn, "P-TEST", 1, itemScores, pairChoices, {
      scoreType: "CSI",
      factorScores: Object.fromEntries(FACTORS.map((factor) => [factor, 0])) as Record<(typeof FACTORS)[number], number>,
      factorCounts: Object.fromEntries(FACTORS.map((factor) => [factor, 0])) as Record<(typeof FACTORS)[number], number>,
      weightedScores: Object.fromEntries(FACTORS.map((factor) => [factor, 0])) as Record<(typeof FACTORS)[number], number>,
      csiScore: 0,
    });

    expect(pairDataCsv(conn).trim().split("\n")).toHaveLength(11);
    conn.close();
  });

  test("pair order is saved and exported in pair csv", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairOrder = Array.from({ length: PAIR_COMPARISONS.length }, (_, index) => index).reverse();
    const pairChoices = pairOrder.map((originalIndex) => PAIR_COMPARISONS[originalIndex][0]);
    const scores = calculateScores(itemScores, pairChoices, pairOrder);
    saveResponse(conn, "P-TEST", 1, itemScores, pairChoices, scores, pairOrder);

    const row = responseRows(conn)[0];
    expect(JSON.parse(row.pair_order_json ?? "")).toEqual(pairOrder);
    const csv = pairDataCsv(conn);
    expect(csv).toContain(`1,${pairOrder[0] + 1}`);
    expect(csv).toContain(PAIR_COMPARISONS[pairOrder[0]][0]);
    conn.close();
  });

  test("deletes single response and blocks condition with responses", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    const responseId = saveResponse(conn, "P-TEST", 1, itemScores, pairChoices, calculateScores(itemScores, pairChoices));

    expect(() => deleteCondition(conn, 1)).toThrow();
    expect(deleteResponse(conn, responseId)).toBe(1);
    expect(deleteCondition(conn, 1)).toBe(1);
    conn.close();
  });

  test("deletes all responses for a participant", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    const scores = calculateScores(itemScores, pairChoices);

    saveResponse(conn, "P-ONE", 1, itemScores, pairChoices, scores);
    saveResponse(conn, "P-ONE", 2, itemScores, pairChoices, scores);
    saveResponse(conn, "P-TWO", 1, itemScores, pairChoices, scores);

    expect(deleteParticipantResponses(conn, "P-ONE")).toBe(2);
    expect(responseRows(conn).map((row) => row.participant_id)).toEqual(["P-TWO"]);
    conn.close();
  });

  test("participant score csv exports latest csi score by condition", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    const scores = calculateScores(itemScores, pairChoices);
    const [condition1, condition2] = listExperimentConditions(conn);

    saveResponse(conn, "P-ONE", condition1.id, itemScores, pairChoices, { ...scores, csiScore: 10 });
    saveResponse(conn, "P-ONE", condition1.id, itemScores, pairChoices, { ...scores, csiScore: 40 });
    saveResponse(conn, "P-ONE", condition2.id, itemScores, pairChoices, { ...scores, csiScore: 20 });
    saveResponse(conn, "P-TWO", condition2.id, itemScores, pairChoices, { ...scores, csiScore: 30 });

    expect(participantScoresCsv(conn)).toBe(
      "participant_id,condition_1_csi_score,condition_2_csi_score,condition_3_csi_score\n" +
        "P-ONE,40,20,\n" +
        "P-TWO,,30,\n",
    );
    conn.close();
  });

  test("participant completion summary tracks three conditions", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    const scores = calculateScores(itemScores, pairChoices);

    for (const row of listExperimentConditions(conn)) {
      saveResponse(conn, "P-THREE", row.id, itemScores, pairChoices, scores);
    }

    expect(participantCompletionSummary(conn)[0]).toMatchObject({
      participant_id: "P-THREE",
      completed_conditions: 3,
      is_complete: true,
      missing_conditions: "",
    });
    conn.close();
  });
});
