import { Button } from "@/components/ui/button";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";

export type ConditionOption = {
  id: number;
  name: string;
};

type ConditionStepProps = {
  participantId: string;
  completedCount: number;
  totalCount: number;
  conditions: ConditionOption[];
  selectedConditionId: number | null;
  onSelectCondition: (conditionId: number) => void;
  onStart: () => void;
};

export function ConditionStep({
  completedCount,
  conditions,
  onSelectCondition,
  onStart,
  participantId,
  selectedConditionId,
  totalCount,
}: ConditionStepProps) {
  return (
    <Panel width="narrow">
      <h2 className="text-xl">回答条件の選択</h2>
      <Field label="ID">
        <TextInput value={participantId} disabled />
      </Field>
      <div className="mt-8 text-gray-500">
        回答済み: {completedCount} / {totalCount || 3}
      </div>
      <Field label="入力する回答を選択">
        <SelectInput value={selectedConditionId ?? ""} onChange={(event) => onSelectCondition(Number(event.target.value))}>
          <option value="" disabled>
            選択してください
          </option>
          {conditions.map((condition) => (
            <option key={condition.id} value={condition.id}>
              {condition.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <div className="mt-5 flex justify-end gap-3">
        <Button type="button" variant="primary" onClick={onStart}>
          評価へ進む
        </Button>
      </div>
    </Panel>
  );
}
