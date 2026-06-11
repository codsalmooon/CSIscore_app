"use client";

import { useEffect, useMemo, useState } from "react";
import { CompletionStep } from "@/components/participant/completion-step";
import { ConditionStep } from "@/components/participant/condition-step";
import { ItemRatingStep } from "@/components/participant/item-rating-step";
import { PairComparisonStep } from "@/components/participant/pair-comparison-step";
import { MessageBox } from "@/components/ui/message-box";
import { PageShell } from "@/components/ui/page-shell";
import {
  ITEMS,
  PAIR_COMPARISONS,
  Factor,
  isParticipantId,
  newParticipantId,
} from "@/lib/csi";

type Condition = {
  id: number;
  name: string;
  created_at: string;
};

type ResumeParticipant = {
  participant_id: string;
  completed_conditions: number;
  total_conditions: number;
  missing_conditions: string[];
};

type Step = "start" | "resume" | "condition" | "items" | "pairs" | "complete";

const STORAGE_KEY = "csi-last-participant-id";

type LocalSession = {
  participantId: string;
  completedConditionIds: number[];
};

function shuffleIndexes(length: number): number[] {
  const indexes = Array.from({ length }, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }
  return indexes;
}

function lastParticipantId(): string {
  if (typeof window === "undefined") {
    return "";
  }
  const stored = window.localStorage.getItem(STORAGE_KEY) ?? "";
  return isParticipantId(stored) ? stored : "";
}

export default function ParticipantPage() {
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [resumeParticipants, setResumeParticipants] = useState<ResumeParticipant[]>([]);
  const [selectedResumeParticipantId, setSelectedResumeParticipantId] = useState("");
  const [session, setSession] = useState<LocalSession>({ participantId: "", completedConditionIds: [] });
  const [step, setStep] = useState<Step>("start");
  const [selectedConditionId, setSelectedConditionId] = useState<number | null>(null);
  const [itemScores, setItemScores] = useState<Record<string, number>>({});
  const [pairOrder, setPairOrder] = useState<number[]>([]);
  const [pairChoices, setPairChoices] = useState<Factor[]>([]);
  const [pairIndex, setPairIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSession({ participantId: lastParticipantId(), completedConditionIds: [] });
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (session.participantId) {
      window.localStorage.setItem(STORAGE_KEY, session.participantId);
    }
  }, [session.participantId]);

  const completedIds = useMemo(() => new Set(session.completedConditionIds), [session.completedConditionIds]);
  const remainingConditions = conditions.filter((condition) => !completedIds.has(condition.id));
  const selectedCondition = conditions.find((condition) => condition.id === selectedConditionId) ?? null;

  useEffect(() => {
    if (step !== "start" && step !== "resume" && conditions.length > 0 && remainingConditions.length === 0) {
      setStep("complete");
    }
  }, [conditions.length, remainingConditions.length, step]);

  async function loadInitialData() {
    const [conditionsResponse, incompleteResponse] = await Promise.all([
      fetch("/api/conditions"),
      fetch("/api/participants/incomplete"),
    ]);
    const conditionsData = (await conditionsResponse.json()) as { conditions: Condition[] };
    const incompleteData = (await incompleteResponse.json()) as { participants: ResumeParticipant[] };
    setConditions(conditionsData.conditions);
    setResumeParticipants(incompleteData.participants);
  }

  function startNewParticipant() {
    setSession({ participantId: newParticipantId(), completedConditionIds: [] });
    setSelectedConditionId(null);
    setSelectedResumeParticipantId("");
    setMessage("");
    setStep("condition");
  }

  function showResumeSelection() {
    if (resumeParticipants.length === 0) {
      return;
    }
    setSelectedResumeParticipantId(resumeParticipants[0]?.participant_id ?? "");
    setMessage("");
    setStep("resume");
  }

  async function resumeSelectedParticipant() {
    if (!selectedResumeParticipantId) {
      setMessage("再開するIDを選択してください。");
      return;
    }
    setMessage("");
    const response = await fetch(
      `/api/participants/${encodeURIComponent(selectedResumeParticipantId)}/completed-conditions`,
    );
    const data = (await response.json()) as { completedConditionIds?: number[]; error?: string };
    if (!response.ok || !data.completedConditionIds) {
      setMessage(data.error ?? "回答済み条件の取得に失敗しました。");
      return;
    }
    setSession({ participantId: selectedResumeParticipantId, completedConditionIds: data.completedConditionIds });
    setSelectedConditionId(null);
    setStep(data.completedConditionIds.length >= conditions.length ? "complete" : "condition");
  }

  function startItems() {
    if (selectedConditionId == null) {
      setMessage("入力する回答を選択してください。");
      return;
    }
    setMessage("");
    setStep("items");
  }

  function startPairs() {
    const scores: Record<string, number> = {};
    for (const item of ITEMS) {
      if (item.scoreable) {
        scores[item.id] = itemScores[item.id] ?? 5;
      }
    }
    const order = shuffleIndexes(PAIR_COMPARISONS.length);
    setItemScores(scores);
    setPairOrder(order);
    setPairChoices(Array(PAIR_COMPARISONS.length).fill(null));
    setPairIndex(0);
    setStep("pairs");
  }

  async function submitResponse(nextChoices: Factor[]) {
    if (selectedConditionId == null) {
      return;
    }
    setIsSaving(true);
    setMessage("");
    const response = await fetch("/api/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId: session.participantId,
        conditionId: selectedConditionId,
        itemScores,
        pairChoices: nextChoices,
        pairOrder,
      }),
    });
    const data = (await response.json()) as { error?: string };
    setIsSaving(false);
    if (!response.ok) {
      setMessage(data.error ?? "回答の保存に失敗しました。");
      return;
    }
    const completedConditionIds = [...new Set([...session.completedConditionIds, selectedConditionId])];
    setSession({ ...session, completedConditionIds });
    setResumeParticipants((participants) =>
      participants.filter(
        (participant) =>
          participant.participant_id !== session.participantId || completedConditionIds.length < participant.total_conditions,
      ),
    );
    setSelectedConditionId(null);
    setItemScores({});
    setPairChoices([]);
    setPairOrder([]);
    setPairIndex(0);
    setStep(completedConditionIds.length >= conditions.length ? "complete" : "condition");
  }

  function choosePair(choice: Factor) {
    const nextChoices = [...pairChoices];
    nextChoices[pairIndex] = choice;
    setPairChoices(nextChoices);
  }

  function nextPair() {
    const choice = pairChoices[pairIndex];
    if (!choice) {
      setMessage("より重要だった項目を選択してください。");
      return;
    }
    setMessage("");
    if (pairIndex === PAIR_COMPARISONS.length - 1) {
      void submitResponse(pairChoices);
      return;
    }
    setPairIndex(pairIndex + 1);
  }

  function resetAll() {
    const nextSession = { participantId: newParticipantId(), completedConditionIds: [] };
    setSession(nextSession);
    setSelectedConditionId(null);
    setSelectedResumeParticipantId("");
    setItemScores({});
    setPairChoices([]);
    setPairOrder([]);
    setPairIndex(0);
    setStep("condition");
    setMessage("");
  }

  return (
    <PageShell title="評価入力フォーム">
      {message && (
        <MessageBox tone="error" width="narrow">
          {message}
        </MessageBox>
      )}

      {step === "start" && (
        <section className="mx-auto max-w-170 rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
          <div className="mx-auto my-8 text-center">
            <button
              type="button"
              className="min-h-11 cursor-pointer rounded-full border border-gray-900 bg-gray-900 px-8 py-4 text-white hover:bg-gray-700"
              onClick={startNewParticipant}
            >
              新規IDで開始
            </button>
          </div>
          <div className="mx-auto my-8 text-center">
            <button
              type="button"
              className="min-h-11 cursor-pointer rounded-full border border-gray-400 bg-white px-8 py-4 text-[#16181d] hover:border-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={resumeParticipants.length === 0}
              onClick={showResumeSelection}
            >
              既存IDで再開
            </button>
          </div>
        </section>
      )}

      {step === "resume" && (
        <section className="mx-auto max-w-170 rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
          <h2 className="text-xl">再開するIDの選択</h2>
          <label className="mt-4 grid gap-2">
            <select
              className="min-h-11 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-[#16181d]"
              value={selectedResumeParticipantId}
              onChange={(event) => setSelectedResumeParticipantId(event.target.value)}
            >
              {resumeParticipants.map((participant) => (
                <option key={participant.participant_id} value={participant.participant_id}>
                  {participant.participant_id} : {participant.completed_conditions} / {participant.total_conditions} 完了
                </option>
              ))}
            </select>
          </label>
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              className="min-h-11 cursor-pointer rounded-lg border border-gray-400 bg-white px-4 py-2 text-[#16181d] hover:border-gray-900"
              onClick={() => setStep("start")}
            >
              戻る
            </button>
            <button
              type="button"
              className="min-h-11 cursor-pointer rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
              onClick={() => void resumeSelectedParticipant()}
            >
              このIDで再開
            </button>
          </div>
        </section>
      )}

      {step === "condition" && (
        <ConditionStep
          completedCount={session.completedConditionIds.length}
          conditions={remainingConditions}
          participantId={session.participantId}
          selectedConditionId={selectedConditionId}
          totalCount={conditions.length}
          onSelectCondition={setSelectedConditionId}
          onStart={startItems}
        />
      )}

      {step === "items" && (
        <ItemRatingStep
          conditionName={selectedCondition?.name}
          itemScores={itemScores}
          onBack={() => setStep("condition")}
          onNext={startPairs}
          onScoreChange={(itemId, score) => setItemScores({ ...itemScores, [itemId]: score })}
        />
      )}

      {step === "pairs" && pairOrder.length > 0 && (
        <PairComparisonStep
          isSaving={isSaving}
          pairChoices={pairChoices}
          pairIndex={pairIndex}
          pairOrder={pairOrder}
          onBack={() => setPairIndex(pairIndex - 1)}
          onChoose={choosePair}
          onNext={nextPair}
        />
      )}

      {step === "complete" && <CompletionStep onReset={resetAll} />}
    </PageShell>
  );
}
