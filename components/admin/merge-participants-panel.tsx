import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";

type MergeParticipantsPanelProps = {
  sourceParticipantId: string;
  targetParticipantId: string;
  onMerge: () => void;
  onSourceParticipantChange: (participantId: string) => void;
  onTargetParticipantChange: (participantId: string) => void;
};

export function MergeParticipantsPanel({
  onMerge,
  onSourceParticipantChange,
  onTargetParticipantChange,
  sourceParticipantId,
  targetParticipantId,
}: MergeParticipantsPanelProps) {
  return (
    <Panel>
      <h2 className="text-xl">ID統合</h2>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3 max-[860px]:grid-cols-1">
        <Field label="統合元ID" className="mt-0">
          <TextInput value={sourceParticipantId} onChange={(event) => onSourceParticipantChange(event.target.value)} />
        </Field>
        <Field label="統合先ID" className="mt-0">
          <TextInput value={targetParticipantId} onChange={(event) => onTargetParticipantChange(event.target.value)} />
        </Field>
        <Button type="button" variant="primary" onClick={onMerge}>
          IDを統合
        </Button>
      </div>
    </Panel>
  );
}
