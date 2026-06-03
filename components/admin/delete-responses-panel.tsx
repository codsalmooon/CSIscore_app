import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";

export type ParticipantOption = {
  participantId: string;
  responseCount: number;
};

type DeleteResponsesPanelProps = {
  participants: ParticipantOption[];
  selectedParticipantId: string;
  onDelete: () => void;
  onSelectParticipant: (participantId: string) => void;
};

export function DeleteResponsesPanel({
  onDelete,
  onSelectParticipant,
  participants,
  selectedParticipantId,
}: DeleteResponsesPanelProps) {
  return (
    <Panel>
      <h2 className="text-xl">削除操作</h2>
      {participants.length === 0 ? (
        <p className="text-gray-500">削除できる回答はありません。</p>
      ) : (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-3 max-[760px]:grid-cols-1">
          <SelectInput value={selectedParticipantId} onChange={(event) => onSelectParticipant(event.target.value)}>
            {participants.map((participant) => (
              <option key={participant.participantId} value={participant.participantId}>
                {participant.participantId} / {participant.responseCount} 件
              </option>
            ))}
          </SelectInput>
          <Button type="button" variant="primary" className="bg-red-700 text-white font-medium border-red-700" onClick={onDelete}>
            参加者の回答を削除
          </Button>
        </div>
      )}
    </Panel>
  );
}
