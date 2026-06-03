import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

type CompletionStepProps = {
  onReset: () => void;
};

export function CompletionStep({ onReset }: CompletionStepProps) {
  return (
    <Panel width="narrow">
      <h1 className="text-[clamp(1.7rem,3vw,2.35rem)]">回答が完了しました</h1>
      <p className="font-semibold text-emerald-700">3条件すべての回答が完了しました。ご回答ありがとうございました。</p>
      <div className="mt-5 flex justify-end gap-3">
        <Button type="button" variant="primary" onClick={onReset}>
          新しい回答を開始する
        </Button>
      </div>
    </Panel>
  );
}
