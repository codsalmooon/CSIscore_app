import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/classNames";
import { Factor, PAIR_COMPARISONS, PAIR_DESCRIPTIONS_JA } from "@/lib/csi";

type PairComparisonStepProps = {
  isSaving: boolean;
  pairChoices: Factor[];
  pairIndex: number;
  pairOrder: number[];
  onBack: () => void;
  onChoose: (choice: Factor) => void;
  onNext: () => void;
};

export function PairComparisonStep({
  isSaving,
  onBack,
  onChoose,
  onNext,
  pairChoices,
  pairIndex,
  pairOrder,
}: PairComparisonStepProps) {
  if (pairOrder.length === 0) {
    return null;
  }

  const originalPairIndex = pairOrder[pairIndex];
  const [factorA, factorB] = PAIR_COMPARISONS[originalPairIndex];
  const selected = pairChoices[pairIndex];
  const isLastPair = pairIndex === PAIR_COMPARISONS.length - 1;

  return (
    <Panel>
      <div className="mb-5 flex items-end justify-between gap-4 max-[760px]:flex-col max-[760px]:items-stretch">
        <h1 className="text-[clamp(1.7rem,3vw,2.35rem)]">
          ペア比較 {pairIndex + 1} / {PAIR_COMPARISONS.length}
        </h1>
        <span className="text-gray-500">このタスクを行ううえで、より重要だったものを選んでください。</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full bg-gray-900 transition-[width] duration-200"
          style={{ width: `${((pairIndex + 1) / PAIR_COMPARISONS.length) * 100}%` }}
        />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
        {[factorA, factorB].map((factor, index) => {
          const isSelected = selected === factor;
          return (
            <button
              className={cn(
                "grid min-h-48 cursor-pointer content-center whitespace-normal rounded-lg border p-6 text-center",
                isSelected ? "border-4 border-gray-900 bg-gray-900 text-white" : "border-gray-400 bg-white text-[#16181d] hover:border-gray-900",
              )}
              key={factor}
              type="button"
              onClick={() => onChoose(factor)}
            >
              <span className={cn("mb-3 block text-sm font-bold", isSelected ? "text-white/80" : "text-gray-500")}>
                項目{index + 1}
              </span>
              {PAIR_DESCRIPTIONS_JA[factor]}
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex justify-between gap-3 max-[760px]:flex-col">
        <Button type="button" disabled={pairIndex === 0} onClick={onBack}>
          戻る
        </Button>
        <Button type="button" variant="primary" disabled={isSaving} onClick={onNext}>
          {isLastPair ? "回答を完了する" : "次へ"}
        </Button>
      </div>
    </Panel>
  );
}
