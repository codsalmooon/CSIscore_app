export const FACTORS = [
  "Enjoyment",
  "Exploration",
  "Expressiveness",
  "Immersion",
  "Results Worth Effort",
  "Collaboration",
] as const;

export type Factor = (typeof FACTORS)[number];

export type CsiItem = {
  id: string;
  factor: Factor;
  scoreable: boolean;
  textJa: string;
};

export const FACTOR_LABELS_JA: Record<Factor, string> = {
  Enjoyment: "楽しさ",
  Exploration: "探索性",
  Expressiveness: "表現性",
  Immersion: "没入感",
  "Results Worth Effort": "努力に見合う成果",
  Collaboration: "共同作業性",
};

export const PAIR_DESCRIPTIONS_JA: Record<Factor, string> = {
  Enjoyment: "ツールを楽しく使えること",
  Exploration: "多くのアイデア・結果・可能性を探索できること",
  Expressiveness: "創造的・表現的でいられること",
  Immersion: "活動に没入できること",
  "Results Worth Effort": "努力に見合う結果を生み出せること",
  Collaboration: "他者と作業できること",
};

export const ITEMS: CsiItem[] = [
  {
    id: "enjoyment_1",
    factor: "Enjoyment",
    scoreable: true,
    textJa: "このシステムまたはツールを日常的に使うことに前向きである。",
  },
  {
    id: "enjoyment_2",
    factor: "Enjoyment",
    scoreable: true,
    textJa: "このシステムまたはツールを使うことは楽しかった。",
  },
  {
    id: "exploration_1",
    factor: "Exploration",
    scoreable: true,
    textJa:
      "このシステムまたはツールを使って、多くの異なるアイデア、選択肢、デザイン、結果を探索しやすかった。",
  },
  {
    id: "exploration_2",
    factor: "Exploration",
    scoreable: true,
    textJa:
      "このシステムまたはツールは、異なるアイデア、結果、可能性を追跡するのに役立った。",
  },
  {
    id: "expressiveness_1",
    factor: "Expressiveness",
    scoreable: true,
    textJa:
      "このシステムまたはツール内で活動している間、とても創造的でいることができた。",
  },
  {
    id: "expressiveness_2",
    factor: "Expressiveness",
    scoreable: true,
    textJa: "このシステムまたはツールは、自分をとても表現しやすくしてくれた。",
  },
  {
    id: "immersion_1",
    factor: "Immersion",
    scoreable: true,
    textJa:
      "注意が活動に完全に向き、使っているシステムまたはツールのことを忘れていた。",
  },
  {
    id: "immersion_2",
    factor: "Immersion",
    scoreable: true,
    textJa:
      "活動に深く没頭し、使っているシステムまたはツールのことを忘れていた。",
  },
  {
    id: "results_worth_effort_1",
    factor: "Results Worth Effort",
    scoreable: true,
    textJa: "このシステムまたはツールから得られたものに満足している。",
  },
  {
    id: "results_worth_effort_2",
    factor: "Results Worth Effort",
    scoreable: true,
    textJa:
      "自分が生み出せた成果は、それを生み出すために払った努力に見合っていた。",
  },
  {
    id: "collaboration_1",
    factor: "Collaboration",
    scoreable: false,
    textJa:
      "このシステムまたはツールは、他の人が自分と一緒に作業することを容易にした。",
  },
  {
    id: "collaboration_2",
    factor: "Collaboration",
    scoreable: false,
    textJa:
      "このシステムまたはツール内で、他の人とアイデアやデザインを共有することはとても簡単だった。",
  },
];

export const SCOREABLE_ITEMS = ITEMS.filter((item) => item.scoreable);

export const PAIR_COMPARISONS: [Factor, Factor][] = FACTORS.flatMap(
  (factor, index) => FACTORS.slice(index + 1).map((other) => [factor, other] as [Factor, Factor]),
);

export type CsiScores = {
  factorScores: Record<Factor, number>;
  factorCounts: Record<Factor, number>;
  weightedScores: Record<Factor, number>;
  csiScore: number;
  scoreType: "CSI";
};

export function newParticipantId(): string {
  return `P-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function zeroFactorRecord(): Record<Factor, number> {
  return Object.fromEntries(FACTORS.map((factor) => [factor, 0])) as Record<Factor, number>;
}

export function calculateScores(
  itemScores: Record<string, number>,
  pairChoices: Factor[],
  pairOrder?: number[] | null,
): CsiScores {
  const factorScores = zeroFactorRecord();
  const factorCounts = zeroFactorRecord();
  const weightedScores = zeroFactorRecord();

  const itemByFactor = Object.fromEntries(
    SCOREABLE_ITEMS.map((item) => [item.factor, [] as number[]]),
  ) as Record<Factor, number[]>;

  for (const item of SCOREABLE_ITEMS) {
    const rawValue = itemScores[item.id];
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 0 || value > 10) {
      throw new Error(`${item.id} must be between 0 and 10.`);
    }
    itemByFactor[item.factor].push(value);
  }

  for (const [factor, values] of Object.entries(itemByFactor) as [Factor, number[]][]) {
    factorScores[factor] = values.reduce((sum, value) => sum + value, 0);
  }

  const expectedChoices = PAIR_COMPARISONS.length;
  if (pairChoices.length !== expectedChoices) {
    throw new Error(`Expected ${expectedChoices} pair choices.`);
  }

  const normalizedPairOrder =
    pairOrder == null ? Array.from({ length: expectedChoices }, (_, index) => index) : pairOrder.map(Number);
  const sortedPairOrder = [...normalizedPairOrder].sort((a, b) => a - b);
  if (
    sortedPairOrder.length !== expectedChoices ||
    !sortedPairOrder.every((value, index) => value === index)
  ) {
    throw new Error("pair_order must contain each pair index exactly once.");
  }

  pairChoices.forEach((choice, index) => {
    const pair = PAIR_COMPARISONS[normalizedPairOrder[index]];
    if (!pair.includes(choice)) {
      throw new Error(`Choice ${choice} is not valid for pair ${pair.join(", ")}.`);
    }
    factorCounts[choice] += 1;
  });

  for (const factor of FACTORS) {
    weightedScores[factor] = factorScores[factor] * factorCounts[factor];
  }

  return {
    factorScores,
    factorCounts,
    weightedScores,
    csiScore: Object.values(weightedScores).reduce((sum, value) => sum + value, 0) / 3,
    scoreType: "CSI",
  };
}

export function isFactor(value: unknown): value is Factor {
  return typeof value === "string" && FACTORS.includes(value as Factor);
}
