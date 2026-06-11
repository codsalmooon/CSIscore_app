import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ITEMS } from "@/lib/csi";

const RATING_TICKS = Array.from({ length: 11 }, (_, index) => index);

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
      <div className="mb-4 flex items-end justify-between gap-4 max-[760px]:flex-col max-[760px]:items-stretch">
        <h2 className="text-xl">10段階評価</h2>
        <span className="text-gray-500">{conditionName}</span>
      </div>
      <div className="border-t border-gray-300 mx-auto py-32 text-center text-lg">
        <p>課題に取り組んだ今回の条件（{conditionName}）において，<br />着座中の椅子や脚の状態を <span className="font-bold">「創造的な課題に取り組むためのシステム」とみなしてください</span>．<br />このシステムが，<span className="font-bold">あなたが創造的な課題に取り組むための思考を，どれだけ支援したか</span> を評価してください．</p>

      </div>
      <div className="grid">
        {ITEMS.map((item) => {
          const value = item.scoreable ? itemScores[item.id] ?? 5 : 0;
          return (

            <div className="border-t border-gray-300 py-16" key={item.id}>
              <p className="mx-auto w-full max-w-3xl pb-4 font-semibold leading-relaxed">{item.textJa}</p>
              <div className="text-center text-sm text-gray-700">
                <strong>{item.scoreable ? value : "回答不要"}</strong>
              </div>
              <RatingSlider
                value={value}
                disabled={!item.scoreable}
                onChange={(score) => onScoreChange(item.id, score)}
              />

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

type RatingSliderProps = {
  value: number;
  disabled: boolean;
  onChange: (score: number) => void;
};

function RatingSlider({ value, disabled, onChange }: RatingSliderProps) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="relative pt-4">
        <input
          className="relative z-10 w-full accent-gray-900 disabled:opacity-50"
          type="range"
          min="0"
          max="10"
          value={value}
          disabled={disabled}
          aria-label="10段階評価"
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <div className="pointer-events-none absolute left-2 right-2 top-1/2 z-20 h-4 -translate-y-1/2">
          {RATING_TICKS.map((tick) => (
            <span
              className="absolute top-0.5 h-4 -translate-x-1/2 -translate-y-1/2 border-l border-gray-400"
              key={tick}
              style={{ left: `${tick * 10}%` }}
            />
          ))}
        </div>
        <div className="relative mx-2 mt-2 h-4 text-xs text-gray-500">
          {RATING_TICKS.map((tick) => (
            <span className="absolute -translate-x-1/2" key={tick} style={{ left: `${tick * 10}%` }}>
              {tick}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 flex justify-between gap-4 text-sm text-gray-500">
        <span>まったくそう思わない</span>
        <span className="text-right">とてもそう思う</span>
      </div>
    </div>
  );
}
