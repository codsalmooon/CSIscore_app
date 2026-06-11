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
  MergeParticipantResponsesError,
  completedConditionIdsForParticipant,
  conditionFriedmanSummary,
  conditionSummary,
  deleteCondition,
  deleteParticipantResponses,
  deleteResponse,
  factorFriedmanSummary,
  factorSummary,
  incompleteParticipantSummaries,
  initDb,
  itemDataCsv,
  listExperimentConditions,
  mergeParticipantResponses,
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

function setSubmittedAt(conn: DatabaseSync, responseId: number, submittedAt: string) {
  conn.prepare("UPDATE responses SET submitted_at = ? WHERE id = ?").run(submittedAt, responseId);
}

function testScores(csiScore: number, factorScore = csiScore) {
  return {
    scoreType: "CSI" as const,
    factorScores: Object.fromEntries(FACTORS.map((factor) => [factor, factorScore])) as Record<(typeof FACTORS)[number], number>,
    factorCounts: Object.fromEntries(FACTORS.map((factor) => [factor, 1])) as Record<(typeof FACTORS)[number], number>,
    weightedScores: Object.fromEntries(FACTORS.map((factor) => [factor, 0])) as Record<(typeof FACTORS)[number], number>,
    csiScore,
  };
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

  test("pair comparisons contain each unordered factor pair exactly once", () => {
    const pairKeys = PAIR_COMPARISONS.map((pair) => [...pair].sort().join("\u0000"));

    expect(PAIR_COMPARISONS).toHaveLength((FACTORS.length * (FACTORS.length - 1)) / 2);
    expect(PAIR_COMPARISONS.every(([factor, other]) => factor !== other)).toBe(true);
    expect(new Set(pairKeys).size).toBe(PAIR_COMPARISONS.length);
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

  test("condition summary only shows condition name and rounded csi statistics", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    const scores = calculateScores(itemScores, pairChoices);

    saveResponse(conn, "P-ONE", 1, itemScores, pairChoices, { ...scores, csiScore: 1 });
    saveResponse(conn, "P-TWO", 1, itemScores, pairChoices, { ...scores, csiScore: 2 });
    saveResponse(conn, "P-THREE", 2, itemScores, pairChoices, { ...scores, csiScore: 4.3333 });

    expect(conditionSummary(conn)).toEqual([
      { condition_name: EXPERIMENT_CONDITION_NAMES[0], csi_mean: "1.500", csi_sd: "0.707" },
      { condition_name: EXPERIMENT_CONDITION_NAMES[1], csi_mean: "4.333", csi_sd: "0.000" },
      { condition_name: EXPERIMENT_CONDITION_NAMES[2], csi_mean: "", csi_sd: "" },
    ]);
    conn.close();
  });

  test("factor summary pivots factors by condition with rounded mean and sd", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    const factorCounts = Object.fromEntries(FACTORS.map((factor) => [factor, 1])) as Record<(typeof FACTORS)[number], number>;
    const weightedScores = Object.fromEntries(FACTORS.map((factor) => [factor, 0])) as Record<(typeof FACTORS)[number], number>;
    const factorScores = (value: number) =>
      Object.fromEntries(FACTORS.map((factor) => [factor, value])) as Record<(typeof FACTORS)[number], number>;

    saveResponse(conn, "P-ONE", 1, itemScores, pairChoices, {
      scoreType: "CSI",
      factorScores: factorScores(1.111),
      factorCounts,
      weightedScores,
      csiScore: 0,
    });
    saveResponse(conn, "P-TWO", 1, itemScores, pairChoices, {
      scoreType: "CSI",
      factorScores: factorScores(2.222),
      factorCounts,
      weightedScores,
      csiScore: 0,
    });
    saveResponse(conn, "P-THREE", 2, itemScores, pairChoices, {
      scoreType: "CSI",
      factorScores: factorScores(3),
      factorCounts,
      weightedScores,
      csiScore: 0,
    });

    const rows = factorSummary(conn);
    expect(rows).toHaveLength(FACTORS.length);
    expect(rows[0]).toEqual({
      factor: FACTORS[0],
      [EXPERIMENT_CONDITION_NAMES[0]]: "1.667 (0.786)",
      [EXPERIMENT_CONDITION_NAMES[1]]: "3.000 (0.000)",
      [EXPERIMENT_CONDITION_NAMES[2]]: "",
    });
    expect(rows.map((row) => row.factor)).toEqual([...FACTORS]);
    conn.close();
  });

  test("condition friedman summary uses complete participants and latest duplicate responses", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    const conditions = listExperimentConditions(conn);

    saveResponse(conn, "P-ONE", conditions[0].id, itemScores, pairChoices, testScores(1));
    saveResponse(conn, "P-ONE", conditions[1].id, itemScores, pairChoices, testScores(2));
    const oldDuplicateId = saveResponse(conn, "P-ONE", conditions[2].id, itemScores, pairChoices, testScores(9));
    const latestDuplicateId = saveResponse(conn, "P-ONE", conditions[2].id, itemScores, pairChoices, testScores(3));
    saveResponse(conn, "P-TWO", conditions[0].id, itemScores, pairChoices, testScores(1));
    saveResponse(conn, "P-TWO", conditions[1].id, itemScores, pairChoices, testScores(3));
    saveResponse(conn, "P-TWO", conditions[2].id, itemScores, pairChoices, testScores(2));
    saveResponse(conn, "P-MISSING", conditions[0].id, itemScores, pairChoices, testScores(100));
    saveResponse(conn, "P-MISSING", conditions[1].id, itemScores, pairChoices, testScores(100));
    setSubmittedAt(conn, oldDuplicateId, "2026-01-01T00:00:00+00:00");
    setSubmittedAt(conn, latestDuplicateId, "2026-01-02T00:00:00+00:00");

    expect(conditionFriedmanSummary(conn)).toEqual([
      {
        measure: "CSIスコア",
        n: 2,
        chi_square: "3.000",
        df: 2,
        p_value: "0.223",
        kendall_w: "0.750",
        [`${conditions[0].name} 平均ランク`]: "1.000",
        [`${conditions[1].name} 平均ランク`]: "2.500",
        [`${conditions[2].name} 平均ランク`]: "2.500",
      },
    ]);
    conn.close();
  });

  test("factor friedman summary returns one result per factor", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    const conditions = listExperimentConditions(conn);

    saveResponse(conn, "P-ONE", conditions[0].id, itemScores, pairChoices, testScores(0, 1));
    saveResponse(conn, "P-ONE", conditions[1].id, itemScores, pairChoices, testScores(0, 2));
    saveResponse(conn, "P-ONE", conditions[2].id, itemScores, pairChoices, testScores(0, 3));
    saveResponse(conn, "P-TWO", conditions[0].id, itemScores, pairChoices, testScores(0, 1));
    saveResponse(conn, "P-TWO", conditions[1].id, itemScores, pairChoices, testScores(0, 3));
    saveResponse(conn, "P-TWO", conditions[2].id, itemScores, pairChoices, testScores(0, 2));

    const rows = factorFriedmanSummary(conn);

    expect(rows).toHaveLength(FACTORS.length);
    expect(rows[0]).toEqual({
      factor: FACTORS[0],
      n: 2,
      chi_square: "3.000",
      df: 2,
      p_value: "0.223",
      kendall_w: "0.750",
      [`${conditions[0].name} 平均ランク`]: "1.000",
      [`${conditions[1].name} 平均ランク`]: "2.500",
      [`${conditions[2].name} 平均ランク`]: "2.500",
    });
    expect(rows.map((row) => row.factor)).toEqual([...FACTORS]);
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
      "\uFEFFparticipant_id,condition_1_csi_score,condition_2_csi_score,condition_3_csi_score\r\n" +
        "P-ONE,40,20,\r\n" +
        "P-TWO,,30,\r\n",
    );
    conn.close();
  });

  test("resume summaries only include incomplete participant ids", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    const scores = calculateScores(itemScores, pairChoices);
    const conditions = listExperimentConditions(conn);

    saveResponse(conn, "P-ONE", conditions[0].id, itemScores, pairChoices, scores);
    for (const condition of conditions) {
      saveResponse(conn, "P-DONE", condition.id, itemScores, pairChoices, scores);
    }

    expect(incompleteParticipantSummaries(conn)).toEqual([
      {
        participant_id: "P-ONE",
        completed_conditions: 1,
        total_conditions: 3,
        missing_conditions: [conditions[1].name, conditions[2].name],
      },
    ]);
    conn.close();
  });

  test("completed condition ids are returned for a participant", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    const scores = calculateScores(itemScores, pairChoices);
    const [condition1, condition2] = listExperimentConditions(conn);

    saveResponse(conn, "P-ONE", condition1.id, itemScores, pairChoices, scores);
    saveResponse(conn, "P-ONE", condition2.id, itemScores, pairChoices, scores);
    saveResponse(conn, "P-TWO", condition1.id, itemScores, pairChoices, scores);

    expect(completedConditionIdsForParticipant(conn, "P-ONE")).toEqual([condition1.id, condition2.id]);
    conn.close();
  });

  test("participant id merge moves responses and reports duplicate deletions", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    const scores = calculateScores(itemScores, pairChoices);

    saveResponse(conn, "P-SRC", 1, itemScores, pairChoices, scores);
    saveResponse(conn, "P-DST", 2, itemScores, pairChoices, scores);

    expect(mergeParticipantResponses(conn, "P-SRC", "P-DST")).toEqual({ updated: 1, deleted: 0 });
    expect(responseRows(conn).map((row) => row.participant_id)).toEqual(["P-DST", "P-DST"]);
    conn.close();
  });

  test("participant id merge rejects completed source or target ids", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    const scores = calculateScores(itemScores, pairChoices);
    const conditions = listExperimentConditions(conn);

    for (const condition of conditions) {
      saveResponse(conn, "P-SRC-DONE", condition.id, itemScores, pairChoices, scores);
      saveResponse(conn, "P-DST-DONE", condition.id, itemScores, pairChoices, scores);
    }
    saveResponse(conn, "P-SRC", conditions[0].id, itemScores, pairChoices, scores);
    saveResponse(conn, "P-DST", conditions[1].id, itemScores, pairChoices, scores);

    expect(() => mergeParticipantResponses(conn, "P-SRC-DONE", "P-DST")).toThrow(MergeParticipantResponsesError);
    expect(() => mergeParticipantResponses(conn, "P-SRC", "P-DST-DONE")).toThrow(MergeParticipantResponsesError);
    conn.close();
  });

  test("participant id merge keeps latest submitted_at response for duplicate conditions", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    const scores = calculateScores(itemScores, pairChoices);
    const [condition1, condition2] = listExperimentConditions(conn);

    const oldResponseId = saveResponse(conn, "P-DST", condition1.id, itemScores, pairChoices, { ...scores, csiScore: 10 });
    const latestResponseId = saveResponse(conn, "P-SRC", condition1.id, itemScores, pairChoices, { ...scores, csiScore: 99 });
    saveResponse(conn, "P-SRC", condition2.id, itemScores, pairChoices, { ...scores, csiScore: 20 });
    setSubmittedAt(conn, oldResponseId, "2026-01-01T00:00:00+00:00");
    setSubmittedAt(conn, latestResponseId, "2026-01-02T00:00:00+00:00");

    expect(mergeParticipantResponses(conn, "P-SRC", "P-DST")).toEqual({ updated: 2, deleted: 1 });
    const rows = responseRows(conn);
    expect(rows.map((row) => row.id)).not.toContain(oldResponseId);
    expect(rows.find((row) => row.id === latestResponseId)).toMatchObject({
      participant_id: "P-DST",
      condition_id: condition1.id,
      csi_score: 99,
    });
    expect(participantScoresCsv(conn)).toContain("P-DST,99,20,");
    expect(rawDataCsv(conn)).not.toContain(`\r\n${oldResponseId},`);
    expect(conditionSummary(conn)[0]).toMatchObject({ csi_mean: "99.000", csi_sd: "0.000" });
    conn.close();
  });

  test("participant id merge uses response id as tie breaker for equal submitted_at duplicates", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    const scores = calculateScores(itemScores, pairChoices);
    const [condition] = listExperimentConditions(conn);

    const olderId = saveResponse(conn, "P-DST", condition.id, itemScores, pairChoices, { ...scores, csiScore: 10 });
    const newerId = saveResponse(conn, "P-SRC", condition.id, itemScores, pairChoices, { ...scores, csiScore: 20 });
    setSubmittedAt(conn, olderId, "2026-01-01T00:00:00+00:00");
    setSubmittedAt(conn, newerId, "2026-01-01T00:00:00+00:00");

    expect(mergeParticipantResponses(conn, "P-SRC", "P-DST")).toEqual({ updated: 1, deleted: 1 });
    expect(responseRows(conn)).toMatchObject([{ id: newerId, participant_id: "P-DST", csi_score: 20 }]);
    conn.close();
  });

  test("csv starts with utf-8 bom and uses crlf line endings", () => {
    const conn = memoryDb();
    const itemScores = defaultItemScores();
    const pairChoices = PAIR_COMPARISONS.map((pair) => pair[0]);
    saveResponse(conn, "P-TEST", 1, itemScores, pairChoices, calculateScores(itemScores, pairChoices));

    const csv = rawDataCsv(conn);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("\r\n");
    expect(csv.replaceAll("\r\n", "")).not.toContain("\n");
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
