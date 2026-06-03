import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ITEMS } from "@/lib/csi";

type ItemRatingStepProps = {
  conditionName?: string;
  itemScores: Record<string, number>;
  onBack: () => void;
  onNext: () => void;
  onScoreChange: (itemId: string, score: number) => void;
};

export function ItemRatingStep({ conditionName, itemScores, onBack, onNext, onScoreChange }: ItemRatingStepProps) {
  return (
    <Panel>
      <div className="mb-5 flex items-end justify-between gap-4 max-[760px]:flex-col max-[760px]:items-stretch">
        <h2 className="text-xl">10段階評価</h2>
        <span className="text-gray-500">{conditionName}</span>
      </div>
      <div className="grid gap-6">
        {ITEMS.map((item) => {
          const value = item.scoreable ? itemScores[item.id] ?? 5 : 0;
          return (
            <div className="border-t border-gray-300 p-8 pt-5" key={item.id}>
              <p className="mb-3 mt-4 font-semibold leading-relaxed">{item.textJa}</p>
              <div className="grid grid-cols-[minmax(8rem,1fr)_minmax(18rem,4fr)_minmax(8rem,1fr)_3rem] items-center gap-3 max-[760px]:grid-cols-[1fr_3rem]">
                <span className="text-right text-sm text-gray-500 max-[760px]:col-span-2 max-[760px]:text-left">
                  まったくそう思わない
                </span>
                <input
                  className="w-full accent-gray-900"
                  type="range"
                  min="0"
                  max="10"
                  value={value}
                  disabled={!item.scoreable}
                  onChange={(event) => onScoreChange(item.id, Number(event.target.value))}
                />
                <span className="text-sm text-gray-500 max-[760px]:col-span-2">とてもそう思う</span>
                <strong>{item.scoreable ? value : "N/A"}</strong>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex justify-between gap-3 max-[760px]:flex-col">
        <Button type="button" onClick={onBack}>
          戻る
        </Button>
        <Button type="button" variant="primary" onClick={onNext}>
          ペア比較へ進む
        </Button>
      </div>
    </Panel>
  );
}
