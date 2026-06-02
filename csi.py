from __future__ import annotations

from itertools import combinations
from typing import Any
from uuid import uuid4

# CSIで扱う6因子
# 今回の研究では，Collaborationを評価しない
# Collaborationはペア比較には含めるが，項目スコアをN/Aとして扱う
FACTORS = [
    "Enjoyment",
    "Exploration",
    "Expressiveness",
    "Immersion",
    "Results Worth Effort",
    "Collaboration",
]

# 因子名の日本語ラベル
FACTOR_LABELS_JA = {
    "Enjoyment": "楽しさ",
    "Exploration": "探索性",
    "Expressiveness": "表現性",
    "Immersion": "没入感",
    "Results Worth Effort": "努力に見合う成果",
    "Collaboration": "共同作業性",
}

# ペア比較画面用の因子ラベル
PAIR_DESCRIPTIONS_JA = {
    "Enjoyment": "ツールを楽しく使えること",
    "Exploration": "多くのアイデア・結果・可能性を探索できること",
    "Expressiveness": "創造的・表現的でいられること",
    "Immersion": "活動に没入できること",
    "Results Worth Effort": "努力に見合う結果を生み出せること",
    "Collaboration": "他者と作業できること",
}

# 10段階評価の項目定義
ITEMS = [
    {
        "id": "enjoyment_1",
        "factor": "Enjoyment",
        "scoreable": True,
        "text_ja": "このシステムまたはツールを日常的に使うことに前向きである。",
    },
    {
        "id": "enjoyment_2",
        "factor": "Enjoyment",
        "scoreable": True,
        "text_ja": "このシステムまたはツールを使うことは楽しかった。",
    },
    {
        "id": "exploration_1",
        "factor": "Exploration",
        "scoreable": True,
        "text_ja": "このシステムまたはツールを使って、多くの異なるアイデア、選択肢、デザイン、結果を探索しやすかった。",
    },
    {
        "id": "exploration_2",
        "factor": "Exploration",
        "scoreable": True,
        "text_ja": "このシステムまたはツールは、異なるアイデア、結果、可能性を追跡するのに役立った。",
    },
    {
        "id": "expressiveness_1",
        "factor": "Expressiveness",
        "scoreable": True,
        "text_ja": "このシステムまたはツール内で活動している間、とても創造的でいることができた。",
    },
    {
        "id": "expressiveness_2",
        "factor": "Expressiveness",
        "scoreable": True,
        "text_ja": "このシステムまたはツールは、自分をとても表現しやすくしてくれた。",
    },
    {
        "id": "immersion_1",
        "factor": "Immersion",
        "scoreable": True,
        "text_ja": "注意が活動に完全に向き、使っているシステムまたはツールのことを忘れていた。",
    },
    {
        "id": "immersion_2",
        "factor": "Immersion",
        "scoreable": True,
        "text_ja": "活動に深く没頭し、使っているシステムまたはツールのことを忘れていた。",
    },
    {
        "id": "results_worth_effort_1",
        "factor": "Results Worth Effort",
        "scoreable": True,
        "text_ja": "このシステムまたはツールから得られたものに満足している。",
    },
    {
        "id": "results_worth_effort_2",
        "factor": "Results Worth Effort",
        "scoreable": True,
        "text_ja": "自分が生み出せた成果は、それを生み出すために払った努力に見合っていた。",
    },
    {
        "id": "collaboration_1",
        "factor": "Collaboration",
        "scoreable": False,
        "text_ja": "このシステムまたはツールは、他の人が自分と一緒に作業することを容易にした。",
    },
    {
        "id": "collaboration_2",
        "factor": "Collaboration",
        "scoreable": False,
        "text_ja": "このシステムまたはツール内で、他の人とアイデアやデザインを共有することはとても簡単だった。",
    },
]

# CSI項目スコアの計算に使う項目だけを抜き出す
SCOREABLE_ITEMS = [item for item in ITEMS if item["scoreable"]]

# ペア比較の組み合わせ生成
PAIR_COMPARISONS = list(combinations(FACTORS, 2))


def new_participant_id() -> str:
    # 匿名参加者IDを作の作成
    # DB保存時に回答者を識別するために用いる
    return f"P-{uuid4().hex[:8].upper()}"


def calculate_scores(
    item_scores: dict[str, int],
    pair_choices: list[str],
    pair_order: list[int] | None = None,
) -> dict[str, Any]:
    """10段階評価とペア比較からCSI総合点を計算"""

    # 初期化
    factor_scores = {factor: 0 for factor in FACTORS}
    factor_counts = {factor: 0 for factor in FACTORS}
    weighted_scores = {factor: 0 for factor in FACTORS}

    # 10段階評価の入力値を検証し，因子ごとに集計
    # scoreable属性のみ集計
    item_by_factor: dict[str, list[int]] = {
        item["factor"]: [] for item in SCOREABLE_ITEMS
    }
    for item in SCOREABLE_ITEMS:
        value = int(item_scores[item["id"]])
        if value < 0 or value > 10:
            raise ValueError(f"{item['id']} must be between 0 and 10.")
        item_by_factor[item["factor"]].append(value)

    # 各因子の項目スコアは，対応する2項目の合計
    for factor, values in item_by_factor.items():
        factor_scores[factor] = sum(values)

    # ペア比較の回答数検証
    expected_choices = len(PAIR_COMPARISONS)
    if len(pair_choices) != expected_choices:
        raise ValueError(f"Expected {expected_choices} pair choices.")

    # pair_orderが渡された場合は、画面で提示したシャッフル順に対応させて検証
    if pair_order is None:
        normalized_pair_order = list(range(expected_choices))
    else:
        normalized_pair_order = [int(index) for index in pair_order]
        if sorted(normalized_pair_order) != list(range(expected_choices)):
            raise ValueError("pair_order must contain each pair index exactly once.")

    # 各ペアで選ばれた因子を数える
    # 選択肢がそのペアに含まれない場合は不正入力として扱う
    for index, choice in enumerate(pair_choices):
        pair = PAIR_COMPARISONS[normalized_pair_order[index]]
        if choice not in pair:
            raise ValueError(f"Choice {choice} is not valid for pair {pair}.")
        factor_counts[choice] += 1

    # 因子スコアに，ペア比較の結果で重み付け
    for factor in FACTORS:
        weighted_scores[factor] = factor_scores[factor] * factor_counts[factor]

    # CSIスコアを算出
    csi_score = sum(weighted_scores.values()) / 3
    return {
        "factor_scores": factor_scores,
        "factor_counts": factor_counts,
        "weighted_scores": weighted_scores,
        "csi_score": csi_score,
        "score_type": "CSI",
    }
