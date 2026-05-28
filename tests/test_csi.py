import csv
import json
import sqlite3
import unittest
from io import StringIO

from csi import (
    ALL_FACTORS,
    COLLABORATION_FACTOR,
    ITEMS,
    PAIR_COMPARISONS,
    calculate_scores,
)
from storage import (
    EXPERIMENT_CONDITION_NAMES,
    delete_condition,
    delete_response,
    init_db,
    list_experiment_conditions,
    pair_data_csv,
    participant_completion_summary,
    save_response,
    response_rows,
)


class CsiScoringTests(unittest.TestCase):
    def test_calculates_manual_scores(self):
        item_scores = {item["id"]: 5 for item in ITEMS}
        pair_choices = [pair[0] for pair in PAIR_COMPARISONS]

        scores = calculate_scores(item_scores, pair_choices)

        self.assertEqual(len(PAIR_COMPARISONS), 15)
        self.assertEqual(scores["factor_scores"]["Enjoyment"], 10)
        self.assertEqual(scores["factor_counts"]["Enjoyment"], 5)
        self.assertEqual(scores["factor_counts"]["Collaboration"], 0)
        self.assertEqual(scores["collaboration_status"], "N/A")
        self.assertEqual(scores["factor_scores"]["Collaboration"], 0)
        self.assertEqual(scores["csi_score"], 50)

    def test_collaboration_is_counted_in_pair_comparisons(self):
        item_scores = {item["id"]: 5 for item in ITEMS}
        pair_choices = [
            COLLABORATION_FACTOR if COLLABORATION_FACTOR in pair else pair[0]
            for pair in PAIR_COMPARISONS
        ]

        scores = calculate_scores(item_scores, pair_choices)

        self.assertEqual(scores["factor_counts"]["Collaboration"], 5)
        self.assertEqual(scores["factor_scores"]["Collaboration"], 0)
        self.assertEqual(scores["weighted_scores"]["Collaboration"], 0)

    def test_max_score_is_100_when_collaboration_is_never_selected(self):
        item_scores = {item["id"]: 10 for item in ITEMS}
        pair_choices = [pair[0] for pair in PAIR_COMPARISONS]

        scores = calculate_scores(item_scores, pair_choices)

        self.assertEqual(scores["csi_score"], 100)

    def test_rejects_non_15_pair_choices(self):
        item_scores = {item["id"]: 5 for item in ITEMS}

        with self.assertRaises(ValueError):
            calculate_scores(item_scores, [pair[0] for pair in PAIR_COMPARISONS[:-1]])

    def test_calculates_scores_with_shuffled_pair_order(self):
        item_scores = {item["id"]: 5 for item in ITEMS}
        pair_order = list(reversed(range(len(PAIR_COMPARISONS))))
        pair_choices = [
            PAIR_COMPARISONS[original_index][1]
            for original_index in pair_order
        ]

        scores = calculate_scores(item_scores, pair_choices, pair_order=pair_order)

        expected_counts = {factor: 0 for factor in ALL_FACTORS}
        for original_index in pair_order:
            expected_counts[PAIR_COMPARISONS[original_index][1]] += 1
        self.assertEqual(scores["factor_counts"], expected_counts)

    def test_rejects_invalid_pair_order(self):
        item_scores = {item["id"]: 5 for item in ITEMS}
        pair_choices = [pair[0] for pair in PAIR_COMPARISONS]
        invalid_order = list(range(len(PAIR_COMPARISONS)))
        invalid_order[-1] = invalid_order[0]

        with self.assertRaises(ValueError):
            calculate_scores(item_scores, pair_choices, pair_order=invalid_order)

    def test_repeated_responses_are_saved_as_separate_rows(self):
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        init_db(conn)
        conn.execute(
            "INSERT INTO conditions (name, created_at) VALUES (?, ?)",
            ("条件A", "2026-05-28T00:00:00+00:00"),
        )
        item_scores = {item["id"]: 5 for item in ITEMS}
        pair_choices = [pair[0] for pair in PAIR_COMPARISONS]
        scores = calculate_scores(item_scores, pair_choices)

        save_response(conn, "P-TEST", 1, item_scores, pair_choices, scores)
        save_response(conn, "P-TEST", 1, item_scores, pair_choices, scores)

        self.assertEqual(len(response_rows(conn)), 2)

    def test_pair_csv_handles_legacy_10_pair_rows(self):
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        init_db(conn)
        conn.execute(
            "INSERT INTO conditions (name, created_at) VALUES (?, ?)",
            ("条件A", "2026-05-28T00:00:00+00:00"),
        )
        item_scores = {item["id"]: 5 for item in ITEMS}
        pair_choices = [pair[0] for pair in PAIR_COMPARISONS[:10]]
        scores = {
            "score_type": "legacy",
            "collaboration_status": "N/A",
            "factor_scores": {factor: 0 for factor in ALL_FACTORS},
            "factor_counts": {factor: 0 for factor in ALL_FACTORS},
            "weighted_scores": {factor: 0 for factor in ALL_FACTORS},
            "csi_score": 0,
        }
        save_response(conn, "P-TEST", 1, item_scores, pair_choices, scores)

        csv_text = pair_data_csv(conn)

        self.assertEqual(csv_text.count("\n"), 11)

    def test_pair_order_is_saved_and_exported_in_pair_csv(self):
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        init_db(conn)
        conn.execute(
            "INSERT INTO conditions (name, created_at) VALUES (?, ?)",
            ("譚｡莉ｶA", "2026-05-28T00:00:00+00:00"),
        )
        item_scores = {item["id"]: 5 for item in ITEMS}
        pair_order = list(reversed(range(len(PAIR_COMPARISONS))))
        pair_choices = [
            PAIR_COMPARISONS[original_index][0]
            for original_index in pair_order
        ]
        scores = calculate_scores(item_scores, pair_choices, pair_order=pair_order)

        save_response(
            conn,
            "P-TEST",
            1,
            item_scores,
            pair_choices,
            scores,
            pair_order=pair_order,
        )

        row = response_rows(conn)[0]
        self.assertEqual(json.loads(row["pair_order_json"]), pair_order)

        csv_rows = list(csv.DictReader(StringIO(pair_data_csv(conn))))
        self.assertEqual(csv_rows[0]["pair_index"], "1")
        self.assertEqual(csv_rows[0]["original_pair_index"], str(pair_order[0] + 1))
        self.assertEqual(csv_rows[0]["factor_a"], PAIR_COMPARISONS[pair_order[0]][0])
        self.assertEqual(csv_rows[0]["factor_b"], PAIR_COMPARISONS[pair_order[0]][1])

    def test_deletes_single_response_and_blocks_condition_with_responses(self):
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        init_db(conn)
        conn.execute(
            "INSERT INTO conditions (name, created_at) VALUES (?, ?)",
            ("条件A", "2026-05-28T00:00:00+00:00"),
        )
        item_scores = {item["id"]: 5 for item in ITEMS}
        pair_choices = [pair[0] for pair in PAIR_COMPARISONS]
        scores = calculate_scores(item_scores, pair_choices)
        response_id = save_response(conn, "P-TEST", 1, item_scores, pair_choices, scores)

        with self.assertRaises(ValueError):
            delete_condition(conn, 1)

        self.assertEqual(delete_response(conn, response_id), 1)
        self.assertEqual(delete_condition(conn, 1), 1)

    def test_experiment_conditions_are_created_in_fixed_order(self):
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        init_db(conn)

        condition_names = [
            row["name"]
            for row in list_experiment_conditions(conn)
        ]

        self.assertEqual(condition_names, list(EXPERIMENT_CONDITION_NAMES))

    def test_participant_completion_summary_tracks_three_conditions(self):
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        init_db(conn)
        conditions = list_experiment_conditions(conn)
        item_scores = {item["id"]: 5 for item in ITEMS}
        pair_choices = [pair[0] for pair in PAIR_COMPARISONS]
        scores = calculate_scores(item_scores, pair_choices)

        for row in conditions:
            save_response(
                conn,
                "P-THREE",
                row["id"],
                item_scores,
                pair_choices,
                scores,
            )

        summary = participant_completion_summary(conn)

        self.assertEqual(summary[0]["participant_id"], "P-THREE")
        self.assertEqual(summary[0]["completed_conditions"], 3)
        self.assertTrue(summary[0]["is_complete"])
        self.assertEqual(summary[0]["missing_conditions"], "")


if __name__ == "__main__":
    unittest.main()
