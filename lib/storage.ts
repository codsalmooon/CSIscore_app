import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { calculateScores, FACTORS, Factor, ITEMS, PAIR_COMPARISONS, CsiScores } from "@/lib/csi";

export const DB_PATH = path.join(process.cwd(), "data", "csi.sqlite3");
export const EXPERIMENT_CONDITION_NAMES = [
  "条件１：なるべく身体を動かさない",
  "条件２：貧乏ゆすりをしながら",
  "条件３：エアマットで揺らされながら",
] as const;

export type ConditionRow = {
  id: number;
  name: string;
  created_at: string;
};

export type ResponseRow = {
  id: number;
  participant_id: string;
  condition_id: number;
  condition_name: string;
  submitted_at: string;
  score_type: string;
  item_scores_json: string;
  pair_choices_json: string;
  pair_order_json: string | null;
  factor_scores_json: string;
  factor_counts_json: string;
  weighted_scores_json: string;
  csi_score: number;
};

export type ParticipantResumeSummary = {
  participant_id: string;
  completed_conditions: number;
  total_conditions: number;
  missing_conditions: string[];
};

type DatabaseConnection = DatabaseSync;

let db: DatabaseConnection | null = null;

export function utcNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

export function connect(dbPath = DB_PATH): DatabaseConnection {
  if (dbPath === DB_PATH && db) {
    return db;
  }
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const conn = new DatabaseSync(dbPath);
  conn.exec("PRAGMA foreign_keys = ON");
  initDb(conn);
  if (dbPath === DB_PATH) {
    db = conn;
  }
  return conn;
}

export function initDb(conn: DatabaseConnection): void {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS conditions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
  `);
  resetLegacyResponseSchema(conn);
  conn.exec(`
    CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id TEXT NOT NULL,
      condition_id INTEGER NOT NULL,
      submitted_at TEXT NOT NULL,
      score_type TEXT NOT NULL,
      item_scores_json TEXT NOT NULL,
      pair_choices_json TEXT NOT NULL,
      pair_order_json TEXT,
      factor_scores_json TEXT NOT NULL,
      factor_counts_json TEXT NOT NULL,
      weighted_scores_json TEXT NOT NULL,
      csi_score REAL NOT NULL,
      FOREIGN KEY (condition_id) REFERENCES conditions(id)
    );
  `);
  ensureResponseSchema(conn);
  ensureExperimentConditions(conn);
}

export function responseSchemaColumns(conn: DatabaseConnection): Set<string> {
  const rows = conn.prepare("PRAGMA table_info(responses)").all() as { name: string }[];
  return new Set(rows.map((row) => row.name));
}

export function resetLegacyResponseSchema(conn: DatabaseConnection): void {
  const columns = responseSchemaColumns(conn);
  if (columns.has("collaboration_status")) {
    conn.exec("DROP TABLE responses");
  }
}

export function ensureResponseSchema(conn: DatabaseConnection): void {
  const columns = responseSchemaColumns(conn);
  if (columns.size > 0 && !columns.has("pair_order_json")) {
    conn.exec("ALTER TABLE responses ADD COLUMN pair_order_json TEXT");
  }
}

export function ensureExperimentConditions(conn: DatabaseConnection): void {
  const stmt = conn.prepare("INSERT OR IGNORE INTO conditions (name, created_at) VALUES (?, ?)");
  conn.exec("BEGIN");
  try {
    for (const name of EXPERIMENT_CONDITION_NAMES) {
      stmt.run(name, utcNow());
    }
    conn.exec("COMMIT");
  } catch (error) {
    conn.exec("ROLLBACK");
    throw error;
  }
}

export function listExperimentConditions(conn = connect()): ConditionRow[] {
  ensureExperimentConditions(conn);
  return conn
    .prepare(
      `
      SELECT id, name, created_at
      FROM conditions
      WHERE name IN (${EXPERIMENT_CONDITION_NAMES.map(() => "?").join(",")})
      ORDER BY CASE name
        WHEN ? THEN 1
        WHEN ? THEN 2
        WHEN ? THEN 3
        ELSE 4
      END
      `,
    )
    .all(...EXPERIMENT_CONDITION_NAMES, ...EXPERIMENT_CONDITION_NAMES) as ConditionRow[];
}

export function conditionResponseCount(conn: DatabaseConnection, conditionId: number): number {
  const row = conn
    .prepare("SELECT COUNT(*) AS response_count FROM responses WHERE condition_id = ?")
    .get(conditionId) as { response_count: number };
  return Number(row.response_count);
}

export function deleteCondition(conn: DatabaseConnection, conditionId: number): number {
  if (conditionResponseCount(conn, conditionId) > 0) {
    throw new Error("この条件には回答が紐づいているため削除できません。先に該当する回答を削除してください。");
  }
  return Number(conn.prepare("DELETE FROM conditions WHERE id = ?").run(conditionId).changes);
}

export function deleteResponse(conn: DatabaseConnection, responseId: number): number {
  return Number(conn.prepare("DELETE FROM responses WHERE id = ?").run(responseId).changes);
}

export function deleteParticipantResponses(conn: DatabaseConnection, participantId: string): number {
  return Number(conn.prepare("DELETE FROM responses WHERE participant_id = ?").run(participantId).changes);
}

export function mergeParticipantResponses(
  conn: DatabaseConnection,
  sourceParticipantId: string,
  targetParticipantId: string,
): number {
  return Number(
    conn
      .prepare("UPDATE responses SET participant_id = ? WHERE participant_id = ?")
      .run(targetParticipantId, sourceParticipantId).changes,
  );
}

export function saveResponse(
  conn: DatabaseConnection,
  participantId: string,
  conditionId: number,
  itemScores: Record<string, number>,
  pairChoices: Factor[],
  scores: CsiScores = calculateScores(itemScores, pairChoices),
  pairOrder: number[] | null = null,
): number {
  ensureResponseSchema(conn);
  const normalizedPairOrder = pairOrder ?? Array.from({ length: pairChoices.length }, (_, index) => index);
  const info = conn
    .prepare(
      `
      INSERT INTO responses (
        participant_id,
        condition_id,
        submitted_at,
        score_type,
        item_scores_json,
        pair_choices_json,
        pair_order_json,
        factor_scores_json,
        factor_counts_json,
        weighted_scores_json,
        csi_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      participantId,
      conditionId,
      utcNow(),
      scores.scoreType,
      JSON.stringify(itemScores),
      JSON.stringify(pairChoices),
      JSON.stringify(normalizedPairOrder),
      JSON.stringify(scores.factorScores),
      JSON.stringify(scores.factorCounts),
      JSON.stringify(scores.weightedScores),
      scores.csiScore,
    );
  return Number(info.lastInsertRowid);
}

export function responseRows(conn = connect()): ResponseRow[] {
  return conn
    .prepare(
      `
      SELECT
        r.id,
        r.participant_id,
        r.condition_id,
        c.name AS condition_name,
        r.submitted_at,
        r.score_type,
        r.item_scores_json,
        r.pair_choices_json,
        r.pair_order_json,
        r.factor_scores_json,
        r.factor_counts_json,
        r.weighted_scores_json,
        r.csi_score
      FROM responses r
      JOIN conditions c ON c.id = r.condition_id
      ORDER BY r.id
      `,
    )
    .all() as ResponseRow[];
}

export function completedConditionIdsForParticipant(conn: DatabaseConnection, participantId: string): number[] {
  const conditions = listExperimentConditions(conn);
  const conditionIds = new Set(conditions.map((condition) => condition.id));
  const rows = conn
    .prepare(
      `
      SELECT DISTINCT condition_id
      FROM responses
      WHERE participant_id = ?
      ORDER BY condition_id
      `,
    )
    .all(participantId) as { condition_id: number }[];
  return rows.map((row) => row.condition_id).filter((conditionId) => conditionIds.has(conditionId));
}

export function incompleteParticipantSummaries(conn = connect()): ParticipantResumeSummary[] {
  const conditions = listExperimentConditions(conn);
  const conditionIds = new Set(conditions.map((condition) => condition.id));
  const grouped = new Map<string, Set<number>>();
  for (const row of responseRows(conn)) {
    if (!conditionIds.has(row.condition_id)) {
      continue;
    }
    const completed = grouped.get(row.participant_id) ?? new Set<number>();
    completed.add(row.condition_id);
    grouped.set(row.participant_id, completed);
  }
  return [...grouped.entries()]
    .filter(([, completedIds]) => completedIds.size < conditions.length)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([participantId, completedIds]) => ({
      participant_id: participantId,
      completed_conditions: completedIds.size,
      total_conditions: conditions.length,
      missing_conditions: conditions
        .filter((condition) => !completedIds.has(condition.id))
        .map((condition) => condition.name),
    }));
}

export function conditionSummary(conn = connect()): Record<string, unknown>[] {
  return conn
    .prepare(
      `
      SELECT
        c.id AS condition_id,
        c.name AS condition_name,
        COUNT(r.id) AS response_count,
        AVG(r.csi_score) AS csi_mean,
        CASE
          WHEN COUNT(r.id) > 1 THEN
            sqrt((SUM(r.csi_score * r.csi_score) - SUM(r.csi_score) * SUM(r.csi_score) / COUNT(r.id)) / (COUNT(r.id) - 1))
          ELSE 0
        END AS csi_sd
      FROM conditions c
      LEFT JOIN responses r ON r.condition_id = c.id
      WHERE c.name IN (${EXPERIMENT_CONDITION_NAMES.map(() => "?").join(",")})
      GROUP BY c.id, c.name
      ORDER BY CASE c.name
        WHEN ? THEN 1
        WHEN ? THEN 2
        WHEN ? THEN 3
        ELSE 4
      END
      `,
    )
    .all(...EXPERIMENT_CONDITION_NAMES, ...EXPERIMENT_CONDITION_NAMES) as Record<string, unknown>[];
}

export function participantCompletionSummary(conn = connect()): Record<string, unknown>[] {
  const fixedNames = new Set<string>(EXPERIMENT_CONDITION_NAMES);
  const grouped = new Map<string, Set<string>>();
  for (const row of responseRows(conn)) {
    if (fixedNames.has(row.condition_name)) {
      const completed = grouped.get(row.participant_id) ?? new Set<string>();
      completed.add(row.condition_name);
      grouped.set(row.participant_id, completed);
    }
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([participantId, completedNames]) => ({
      participant_id: participantId,
      completed_conditions: completedNames.size,
      total_conditions: EXPERIMENT_CONDITION_NAMES.length,
      is_complete: completedNames.size === EXPERIMENT_CONDITION_NAMES.length,
      missing_conditions: EXPERIMENT_CONDITION_NAMES.filter((name) => !completedNames.has(name)).join(", "),
    }));
}

export function factorSummary(conn = connect()): Record<string, unknown>[] {
  const grouped = new Map<string, { conditionId: number; conditionName: string; factor: Factor; values: number[] }>();
  for (const row of responseRows(conn)) {
    const factorScores = JSON.parse(row.factor_scores_json) as Partial<Record<Factor, number>>;
    for (const factor of FACTORS) {
      const key = `${row.condition_id}\u0000${row.condition_name}\u0000${factor}`;
      const entry =
        grouped.get(key) ?? { conditionId: row.condition_id, conditionName: row.condition_name, factor, values: [] };
      entry.values.push(Number(factorScores[factor] ?? 0));
      grouped.set(key, entry);
    }
  }
  return [...grouped.values()]
    .sort((a, b) => a.conditionId - b.conditionId || FACTORS.indexOf(a.factor) - FACTORS.indexOf(b.factor))
    .map((entry) => {
      const mean = entry.values.reduce((sum, value) => sum + value, 0) / entry.values.length;
      const sd =
        entry.values.length > 1
          ? Math.sqrt(entry.values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (entry.values.length - 1))
          : 0;
      return {
        condition_id: entry.conditionId,
        condition_name: entry.conditionName,
        factor: entry.factor,
        response_count: entry.values.length,
        factor_score_mean: mean,
        factor_score_sd: sd,
      };
    });
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csvText(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return "\uFEFF";
  }
  const headers = Object.keys(rows[0]);
  const body = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\r\n") + "\r\n";
  return `\uFEFF${body}`;
}

export function rawDataCsv(conn = connect()): string {
  const rows = responseRows(conn).map((row) => {
    const itemScores = JSON.parse(row.item_scores_json) as Record<string, number>;
    const factorScores = JSON.parse(row.factor_scores_json) as Partial<Record<Factor, number>>;
    const factorCounts = JSON.parse(row.factor_counts_json) as Partial<Record<Factor, number>>;
    const weightedScores = JSON.parse(row.weighted_scores_json) as Partial<Record<Factor, number>>;
    const flat: Record<string, unknown> = {
      response_id: row.id,
      participant_id: row.participant_id,
      condition_id: row.condition_id,
      condition_name: row.condition_name,
      submitted_at: row.submitted_at,
      score_type: row.score_type,
      csi_score: row.csi_score,
    };
    for (const item of ITEMS) {
      flat[item.id] = item.scoreable ? itemScores[item.id] : "N/A";
    }
    for (const factor of FACTORS) {
      flat[`${factor}_score`] = factorScores[factor] ?? 0;
      flat[`${factor}_count`] = factorCounts[factor] ?? 0;
      flat[`${factor}_weighted`] = weightedScores[factor] ?? 0;
    }
    return flat;
  });
  return csvText(rows);
}

export function participantScoresCsv(conn = connect()): string {
  const conditions = listExperimentConditions(conn);
  const latestByParticipant = new Map<string, Map<number, ResponseRow>>();
  for (const row of responseRows(conn)) {
    const participantRows = latestByParticipant.get(row.participant_id) ?? new Map<number, ResponseRow>();
    const current = participantRows.get(row.condition_id);
    if (!current || row.id > current.id) {
      participantRows.set(row.condition_id, row);
    }
    latestByParticipant.set(row.participant_id, participantRows);
  }

  const rows = [...latestByParticipant.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([participantId, conditionRows]) => {
      const flat: Record<string, unknown> = { participant_id: participantId };
      conditions.forEach((condition, index) => {
        flat[`condition_${index + 1}_csi_score`] = conditionRows.get(condition.id)?.csi_score ?? "";
      });
      return flat;
    });
  return csvText(rows);
}

export function itemDataCsv(conn = connect()): string {
  const rows = responseRows(conn).flatMap((row) => {
    const itemScores = JSON.parse(row.item_scores_json) as Record<string, number>;
    return ITEMS.map((item) => ({
      response_id: row.id,
      participant_id: row.participant_id,
      condition_id: row.condition_id,
      condition_name: row.condition_name,
      submitted_at: row.submitted_at,
      item_id: item.id,
      factor: item.factor,
      item_text_ja: item.textJa,
      score: item.scoreable ? itemScores[item.id] : "N/A",
    }));
  });
  return csvText(rows);
}

export function factorDataCsv(conn = connect()): string {
  const rows = responseRows(conn).flatMap((row) => {
    const factorScores = JSON.parse(row.factor_scores_json) as Partial<Record<Factor, number>>;
    const factorCounts = JSON.parse(row.factor_counts_json) as Partial<Record<Factor, number>>;
    const weightedScores = JSON.parse(row.weighted_scores_json) as Partial<Record<Factor, number>>;
    return FACTORS.map((factor) => ({
      response_id: row.id,
      participant_id: row.participant_id,
      condition_id: row.condition_id,
      condition_name: row.condition_name,
      submitted_at: row.submitted_at,
      score_type: row.score_type,
      factor,
      factor_score: factorScores[factor] ?? 0,
      factor_count: factorCounts[factor] ?? 0,
      weighted_factor_score: weightedScores[factor] ?? 0,
      csi_score: row.csi_score,
    }));
  });
  return csvText(rows);
}

export function conditionSummaryCsv(conn = connect()): string {
  return csvText(conditionSummary(conn));
}

export function pairDataCsv(conn = connect()): string {
  const rows = responseRows(conn).flatMap((row) => {
    const pairChoices = JSON.parse(row.pair_choices_json) as Factor[];
    const pairOrder = row.pair_order_json
      ? (JSON.parse(row.pair_order_json) as number[])
      : Array.from({ length: pairChoices.length }, (_, index) => index);
    return pairChoices.map((choice, index) => {
      const originalIndex = pairOrder[index] ?? index;
      const pair = originalIndex >= 0 && originalIndex < PAIR_COMPARISONS.length ? PAIR_COMPARISONS[originalIndex] : ["", ""];
      return {
        response_id: row.id,
        participant_id: row.participant_id,
        condition_id: row.condition_id,
        condition_name: row.condition_name,
        submitted_at: row.submitted_at,
        pair_index: index + 1,
        original_pair_index: pair[0] ? originalIndex + 1 : "",
        factor_a: pair[0],
        factor_b: pair[1],
        chosen_factor: choice,
      };
    });
  });
  return csvText(rows);
}
