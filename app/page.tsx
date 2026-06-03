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

type Step = "condition" | "items" | "pairs" | "complete";

const STORAGE_KEY = "csi-local-session";

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

function loadSession(): LocalSession {
  if (typeof window === "undefined") {
    return { participantId: "", completedConditionIds: [] };
  }
  const stored = window.sessionStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as LocalSession;
      if (isParticipantId(parsed.participantId)) {
        return {
          participantId: parsed.participantId,
          completedConditionIds: parsed.completedConditionIds ?? [],
        };
      }
    } catch {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  }
  const created = { participantId: newParticipantId(), completedConditionIds: [] };
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(created));
  return created;
}

export default function ParticipantPage() {
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [session, setSession] = useState<LocalSession>({ participantId: "", completedConditionIds: [] });
  const [step, setStep] = useState<Step>("condition");
  const [selectedConditionId, setSelectedConditionId] = useState<number | null>(null);
  const [itemScores, setItemScores] = useState<Record<string, number>>({});
  const [pairOrder, setPairOrder] = useState<number[]>([]);
  const [pairChoices, setPairChoices] = useState<Factor[]>([]);
  const [pairIndex, setPairIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSession(loadSession());
    fetch("/api/conditions")
      .then((response) => response.json())
      .then((data: { conditions: Condition[] }) => setConditions(data.conditions));
  }, []);

  useEffect(() => {
    if (session.participantId) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  }, [session]);

  const completedIds = useMemo(() => new Set(session.completedConditionIds), [session.completedConditionIds]);
  const remainingConditions = conditions.filter((condition) => !completedIds.has(condition.id));
  const selectedCondition = conditions.find((condition) => condition.id === selectedConditionId) ?? null;

  useEffect(() => {
    if (conditions.length > 0 && remainingConditions.length === 0) {
      setStep("complete");
    }
  }, [conditions.length, remainingConditions.length]);

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
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    setSelectedConditionId(null);
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
