from __future__ import annotations

import csv
import json
import sqlite3
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from typing import Any

from csi import FACTORS, ITEMS, PAIR_COMPARISONS


DB_PATH = Path("data/csi.sqlite3")
EXPERIMENT_CONDITION_NAMES = (
    "統制条件",
    "実験条件１（自律）",
    "実験条件２（他律）",
)


def connect(db_path: Path = DB_PATH) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS conditions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        );
        """
    )
    reset_legacy_response_schema(conn)
    conn.executescript(
        """

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
        """
    )
    ensure_response_schema(conn)
    ensure_experiment_conditions(conn)
    conn.commit()


def response_schema_columns(conn: sqlite3.Connection) -> set[str]:
    return {
        row["name"]
        for row in conn.execute("PRAGMA table_info(responses)").fetchall()
    }


def reset_legacy_response_schema(conn: sqlite3.Connection) -> None:
    columns = response_schema_columns(conn)
    if "collaboration_status" in columns:
        conn.execute("DROP TABLE responses")
        conn.commit()


def ensure_response_schema(conn: sqlite3.Connection) -> None:
    columns = response_schema_columns(conn)
    if "pair_order_json" not in columns:
        conn.execute("ALTER TABLE responses ADD COLUMN pair_order_json TEXT")
        conn.commit()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def ensure_experiment_conditions(conn: sqlite3.Connection) -> None:
    for name in EXPERIMENT_CONDITION_NAMES:
        conn.execute(
            "INSERT OR IGNORE INTO conditions (name, created_at) VALUES (?, ?)",
            (name, utc_now()),
        )
    conn.commit()


def add_condition(conn: sqlite3.Connection, name: str) -> None:
    cleaned = name.strip()
    if not cleaned:
        raise ValueError("条件名を入力してください。")
    conn.execute(
        "INSERT INTO conditions (name, created_at) VALUES (?, ?)",
        (cleaned, utc_now()),
    )
    conn.commit()


def list_conditions(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT id, name, created_at FROM conditions ORDER BY id"
    ).fetchall()


def list_experiment_conditions(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    ensure_experiment_conditions(conn)
    placeholders = ",".join("?" for _ in EXPERIMENT_CONDITION_NAMES)
    return conn.execute(
        f"""
        SELECT id, name, created_at
        FROM conditions
        WHERE name IN ({placeholders})
        ORDER BY CASE name
            WHEN ? THEN 1
            WHEN ? THEN 2
            WHEN ? THEN 3
            ELSE 4
        END
        """,
        (*EXPERIMENT_CONDITION_NAMES, *EXPERIMENT_CONDITION_NAMES),
    ).fetchall()


def condition_response_count(conn: sqlite3.Connection, condition_id: int) -> int:
    row = conn.execute(
        "SELECT COUNT(*) AS response_count FROM responses WHERE condition_id = ?",
        (condition_id,),
    ).fetchone()
    return int(row["response_count"])


def delete_condition(conn: sqlite3.Connection, condition_id: int) -> int:
    if condition_response_count(conn, condition_id) > 0:
        raise ValueError("この条件には回答が紐づいているため削除できません。先に該当する回答を削除してください。")
    cur = conn.execute("DELETE FROM conditions WHERE id = ?", (condition_id,))
    conn.commit()
    return int(cur.rowcount)


def delete_response(conn: sqlite3.Connection, response_id: int) -> int:
    cur = conn.execute("DELETE FROM responses WHERE id = ?", (response_id,))
    conn.commit()
    return int(cur.rowcount)


def save_response(
    conn: sqlite3.Connection,
    participant_id: str,
    condition_id: int,
    item_scores: dict[str, int],
    pair_choices: list[str],
    scores: dict[str, Any],
    pair_order: list[int] | None = None,
) -> int:
    ensure_response_schema(conn)
    if pair_order is None:
        pair_order = list(range(len(pair_choices)))
    cur = conn.execute(
        """
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
        """,
        (
            participant_id,
            condition_id,
            utc_now(),
            scores["score_type"],
            json.dumps(item_scores, ensure_ascii=False),
            json.dumps(pair_choices, ensure_ascii=False),
            json.dumps(pair_order, ensure_ascii=False),
            json.dumps(scores["factor_scores"], ensure_ascii=False),
            json.dumps(scores["factor_counts"], ensure_ascii=False),
            json.dumps(scores["weighted_scores"], ensure_ascii=False),
            scores["csi_score"],
        ),
    )
    conn.commit()
    return int(cur.lastrowid)


def response_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """
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
        """
    ).fetchall()


def condition_summary(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    placeholders = ",".join("?" for _ in EXPERIMENT_CONDITION_NAMES)
    return conn.execute(
        f"""
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
        WHERE c.name IN ({placeholders})
        GROUP BY c.id, c.name
        ORDER BY CASE c.name
            WHEN ? THEN 1
            WHEN ? THEN 2
            WHEN ? THEN 3
            ELSE 4
        END
        """,
        (*EXPERIMENT_CONDITION_NAMES, *EXPERIMENT_CONDITION_NAMES),
    ).fetchall()


def participant_completion_summary(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = response_rows(conn)
    fixed_names = set(EXPERIMENT_CONDITION_NAMES)
    grouped: dict[str, set[str]] = {}
    for row in rows:
        if row["condition_name"] in fixed_names:
            grouped.setdefault(row["participant_id"], set()).add(row["condition_name"])

    summary = []
    for participant_id, completed_names in sorted(grouped.items()):
        summary.append(
            {
                "participant_id": participant_id,
                "completed_conditions": len(completed_names),
                "total_conditions": len(EXPERIMENT_CONDITION_NAMES),
                "is_complete": len(completed_names) == len(EXPERIMENT_CONDITION_NAMES),
                "missing_conditions": ", ".join(
                    name
                    for name in EXPERIMENT_CONDITION_NAMES
                    if name not in completed_names
                ),
            }
        )
    return summary


def factor_summary(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = response_rows(conn)
    grouped: dict[tuple[int, str, str], list[float]] = {}
    for row in rows:
        factor_scores = json.loads(row["factor_scores_json"])
        for factor in FACTORS:
            key = (row["condition_id"], row["condition_name"], factor)
            grouped.setdefault(key, []).append(float(factor_scores.get(factor, 0)))

    summary = []
    for (condition_id, condition_name, factor), values in sorted(grouped.items()):
        mean = sum(values) / len(values)
        if len(values) > 1:
            variance = sum((value - mean) ** 2 for value in values) / (len(values) - 1)
            sd = variance ** 0.5
        else:
            sd = 0.0
        summary.append(
            {
                "condition_id": condition_id,
                "condition_name": condition_name,
                "factor": factor,
                "response_count": len(values),
                "factor_score_mean": mean,
                "factor_score_sd": sd,
            }
        )
    return summary


def csv_text(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return ""
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()), lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


def raw_data_csv(conn: sqlite3.Connection) -> str:
    rows = []
    for row in response_rows(conn):
        item_scores = json.loads(row["item_scores_json"])
        factor_scores = json.loads(row["factor_scores_json"])
        factor_counts = json.loads(row["factor_counts_json"])
        weighted_scores = json.loads(row["weighted_scores_json"])
        flat = {
            "response_id": row["id"],
            "participant_id": row["participant_id"],
            "condition_id": row["condition_id"],
            "condition_name": row["condition_name"],
            "submitted_at": row["submitted_at"],
            "score_type": row["score_type"],
            "csi_score": row["csi_score"],
        }
        for item in ITEMS:
            flat[item["id"]] = item_scores.get(item["id"]) if item["scoreable"] else "N/A"
        for factor in FACTORS:
            flat[f"{factor}_score"] = factor_scores.get(factor, 0)
            flat[f"{factor}_count"] = factor_counts.get(factor, 0)
            flat[f"{factor}_weighted"] = weighted_scores.get(factor, 0)
        rows.append(flat)
    return csv_text(rows)


def item_data_csv(conn: sqlite3.Connection) -> str:
    rows = []
    for row in response_rows(conn):
        item_scores = json.loads(row["item_scores_json"])
        for item in ITEMS:
            rows.append(
                {
                    "response_id": row["id"],
                    "participant_id": row["participant_id"],
                    "condition_id": row["condition_id"],
                    "condition_name": row["condition_name"],
                    "submitted_at": row["submitted_at"],
                    "item_id": item["id"],
                    "factor": item["factor"],
                    "item_text_ja": item["text_ja"],
                    "score": item_scores[item["id"]] if item["scoreable"] else "N/A",
                }
            )
    return csv_text(rows)


def factor_data_csv(conn: sqlite3.Connection) -> str:
    rows = []
    for row in response_rows(conn):
        factor_scores = json.loads(row["factor_scores_json"])
        factor_counts = json.loads(row["factor_counts_json"])
        weighted_scores = json.loads(row["weighted_scores_json"])
        for factor in FACTORS:
            rows.append(
                {
                    "response_id": row["id"],
                    "participant_id": row["participant_id"],
                    "condition_id": row["condition_id"],
                    "condition_name": row["condition_name"],
                    "submitted_at": row["submitted_at"],
                    "score_type": row["score_type"],
                    "factor": factor,
                    "factor_score": factor_scores.get(factor, 0),
                    "factor_count": factor_counts.get(factor, 0),
                    "weighted_factor_score": weighted_scores.get(factor, 0),
                    "csi_score": row["csi_score"],
                }
            )
    return csv_text(rows)


def condition_summary_csv(conn: sqlite3.Connection) -> str:
    rows = [dict(row) for row in condition_summary(conn)]
    return csv_text(rows)


def pair_data_csv(conn: sqlite3.Connection) -> str:
    rows = []
    for row in response_rows(conn):
        pair_choices = json.loads(row["pair_choices_json"])
        raw_pair_order = row["pair_order_json"] if "pair_order_json" in row.keys() else None
        pair_order = json.loads(raw_pair_order) if raw_pair_order else list(range(len(pair_choices)))
        for index, choice in enumerate(pair_choices):
            original_index = pair_order[index] if index < len(pair_order) else index
            pair = (
                PAIR_COMPARISONS[original_index]
                if 0 <= original_index < len(PAIR_COMPARISONS)
                else ("", "")
            )
            rows.append(
                {
                    "response_id": row["id"],
                    "participant_id": row["participant_id"],
                    "condition_id": row["condition_id"],
                    "condition_name": row["condition_name"],
                    "submitted_at": row["submitted_at"],
                    "pair_index": index + 1,
                    "original_pair_index": original_index + 1 if pair[0] else "",
                    "factor_a": pair[0],
                    "factor_b": pair[1],
                    "chosen_factor": choice,
                }
            )
    return csv_text(rows)
