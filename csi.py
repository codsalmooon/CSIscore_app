from __future__ import annotations

from itertools import combinations
from typing import Any
from uuid import uuid4


COLLABORATION_FACTOR = "Collaboration"

ACTIVE_FACTORS = [
    "Enjoyment",
    "Exploration",
    "Expressiveness",
    "Immersion",
    "Results Worth Effort",
    COLLABORATION_FACTOR,
]

ALL_FACTORS = ACTIVE_FACTORS

FACTOR_LABELS_JA = {
    "Enjoyment": "楽しさ",
    "Exploration": "探索性",
    "Expressiveness": "表現性",
    "Immersion": "没入感",
    "Results Worth Effort": "努力に見合う成果",
    "Collaboration": "共同作業性",
}

PAIR_DESCRIPTIONS_JA = {
    "Enjoyment": "ツールを楽しく使えること",
    "Exploration": "多くのアイデア・結果・可能性を探索できること",
    "Expressiveness": "創造的・表現的でいられること",
    "Immersion": "活動に没入できること",
    "Results Worth Effort": "努力に見合う結果を生み出せること",
    "Collaboration": "他者と作業できること",
}

ITEMS = [
    {
        "id": "enjoyment_1",
        "factor": "Enjoyment",
        "text_ja": "このシステムまたはツールを日常的に使うことに前向きである。",
    },
    {
        "id": "enjoyment_2",
        "factor": "Enjoyment",
        "text_ja": "このシステムまたはツールを使うことは楽しかった。",
    },
    {
        "id": "exploration_1",
        "factor": "Exploration",
        "text_ja": "このシステムまたはツールを使って、多くの異なるアイデア、選択肢、デザイン、結果を探索しやすかった。",
    },
    {
        "id": "exploration_2",
        "factor": "Exploration",
        "text_ja": "このシステムまたはツールは、異なるアイデア、結果、可能性を追跡するのに役立った。",
    },
    {
        "id": "expressiveness_1",
        "factor": "Expressiveness",
        "text_ja": "このシステムまたはツール内で活動している間、とても創造的でいることができた。",
    },
    {
        "id": "expressiveness_2",
        "factor": "Expressiveness",
        "text_ja": "このシステムまたはツールは、自分をとても表現しやすくしてくれた。",
    },
    {
        "id": "immersion_1",
        "factor": "Immersion",
        "text_ja": "注意が活動に完全に向き、使っているシステムまたはツールのことを忘れていた。",
    },
    {
        "id": "immersion_2",
        "factor": "Immersion",
        "text_ja": "活動に深く没頭し、使っているシステムまたはツールのことを忘れていた。",
    },
    {
        "id": "results_worth_effort_1",
        "factor": "Results Worth Effort",
        "text_ja": "このシステムまたはツールから得られたものに満足している。",
    },
    {
        "id": "results_worth_effort_2",
        "factor": "Results Worth Effort",
        "text_ja": "自分が生み出せた成果は、それを生み出すために払った努力に見合っていた。",
    },
]

COLLABORATION_ITEMS = [
    {
        "id": "collaboration_1",
        "factor": COLLABORATION_FACTOR,
        "text_ja": "このシステムまたはツールは、他の人が自分と一緒に作業することを容易にした。",
    },
    {
        "id": "collaboration_2",
        "factor": COLLABORATION_FACTOR,
        "text_ja": "このシステムまたはツール内で、他の人とアイデアやデザインを共有することはとても簡単だった。",
    },
]

DISPLAY_ITEMS = ITEMS + COLLABORATION_ITEMS
PAIR_COMPARISONS = list(combinations(ACTIVE_FACTORS, 2))


def new_participant_id() -> str:
    return f"P-{uuid4().hex[:8].upper()}"


def calculate_scores(
    item_scores: dict[str, int],
    pair_choices: list[str],
    pair_order: list[int] | None = None,
) -> dict[str, Any]:
    factor_scores = {factor: 0 for factor in ALL_FACTORS}
    factor_counts = {factor: 0 for factor in ALL_FACTORS}
    weighted_scores = {factor: 0 for factor in ALL_FACTORS}

    item_by_factor: dict[str, list[int]] = {
        factor: [] for factor in ACTIVE_FACTORS if factor != COLLABORATION_FACTOR
    }
    for item in ITEMS:
        value = int(item_scores[item["id"]])
        if value < 0 or value > 10:
            raise ValueError(f"{item['id']} must be between 0 and 10.")
        item_by_factor[item["factor"]].append(value)

    for factor, values in item_by_factor.items():
        factor_scores[factor] = sum(values)

    expected_choices = len(PAIR_COMPARISONS)
    if len(pair_choices) != expected_choices:
        raise ValueError(f"Expected {expected_choices} pair choices.")

    if pair_order is None:
        normalized_pair_order = list(range(expected_choices))
    else:
        normalized_pair_order = [int(index) for index in pair_order]
        if sorted(normalized_pair_order) != list(range(expected_choices)):
            raise ValueError("pair_order must contain each pair index exactly once.")

    for index, choice in enumerate(pair_choices):
        pair = PAIR_COMPARISONS[normalized_pair_order[index]]
        if choice not in pair:
            raise ValueError(f"Choice {choice} is not valid for pair {pair}.")
        factor_counts[choice] += 1

    for factor in ALL_FACTORS:
        weighted_scores[factor] = factor_scores[factor] * factor_counts[factor]

    csi_score = sum(weighted_scores.values()) / 3
    return {
        "factor_scores": factor_scores,
        "factor_counts": factor_counts,
        "weighted_scores": weighted_scores,
        "csi_score": csi_score,
        "score_type": "6因子版CSI（Collaboration項目N/A）",
        "collaboration_status": "N/A",
    }
