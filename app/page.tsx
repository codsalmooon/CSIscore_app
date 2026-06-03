"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ITEMS,
  PAIR_COMPARISONS,
  PAIR_DESCRIPTIONS_JA,
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

  const buttonBase =
    "min-h-11 cursor-pointer rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryButton = `${buttonBase} border-gray-400 bg-white text-[#16181d] hover:border-gray-900`;
  const primaryButton = `${buttonBase} border-gray-900 bg-gray-900 text-white hover:bg-gray-700`;
  const panelBase = "mx-auto mb-4 rounded-lg border border-gray-300 bg-white p-6 shadow-sm";
  const fieldClass = "mt-4 grid gap-2";
  const fieldLabelClass = "text-sm font-semibold text-gray-500";
  const inputClass = "min-h-11 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-[#16181d]";

  return (
    <main className="mx-auto w-[min(1120px,calc(100%-2rem))] px-0 pb-12 pt-4">
      <header className="flex items-center justify-between gap-4 pb-5 pt-2 max-[760px]:grid max-[760px]:items-stretch">
        <a className="text-[1.05rem] font-bold">
          評価入力フォーム
        </a>
      </header>

      {message && (
        <div className="mx-auto mb-4 max-w-170 rounded-lg border border-red-300 bg-[#fff8e8] px-4 py-3 text-red-700">
          {message}
        </div>
      )}

      {step === "condition" && (
        <section className={`${panelBase} max-w-170`}>
          <h2 className="text-xl">回答条件の選択</h2>
          <label className={fieldClass}>
            <span className={fieldLabelClass}>ID</span>
            <input className={inputClass} value={session.participantId} disabled />
          </label>
          <div className="mt-8 text-gray-500">
            回答済み: {session.completedConditionIds.length} / {conditions.length || 3}
          </div>
          <label className={fieldClass}>
            <span className={fieldLabelClass}>入力する回答を選択</span>
            <select
              className={inputClass}
              value={selectedConditionId ?? ""}
              onChange={(event) => setSelectedConditionId(Number(event.target.value))}
            >
              <option value="" disabled>
                選択してください
              </option>
              {remainingConditions.map((condition) => (
                <option key={condition.id} value={condition.id}>
                  {condition.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-5 flex justify-end gap-3">
            <button className={primaryButton} type="button" onClick={startItems}>
              評価へ進む
            </button>
          </div>
        </section>
      )}

      {step === "items" && (
        <section className={`${panelBase} max-w-full`}>
          <div className="mb-5 flex items-end justify-between gap-4 max-[760px]:flex-col max-[760px]:items-stretch">
            <h2 className="text-xl">10段階評価</h2>
            <span className="text-gray-500">{selectedCondition?.name}</span>
          </div>
          <div className="grid gap-6">
            {ITEMS.map((item) => {
              const value = item.scoreable ? itemScores[item.id] ?? 5 : 0;
              return (
                <div className="p-8 border-t border-gray-300 pt-5" key={item.id}>
                  <p className="mt-4 mb-3 font-semibold leading-relaxed">{item.textJa}</p>
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
                      onChange={(event) =>
                        setItemScores({ ...itemScores, [item.id]: Number(event.target.value) })
                      }
                    />
                    <span className="text-sm text-gray-500 max-[760px]:col-span-2">とてもそう思う</span>
                    <strong>{item.scoreable ? value : "N/A"}</strong>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex justify-between gap-3 max-[760px]:flex-col">
            <button className={secondaryButton} type="button" onClick={() => setStep("condition")}>
              戻る
            </button>
            <button className={primaryButton} type="button" onClick={startPairs}>
              ペア比較へ進む
            </button>
          </div>
        </section>
      )}

      {step === "pairs" && pairOrder.length > 0 && (
        <section className={`${panelBase} max-w-full`}>
          {(() => {
            const originalPairIndex = pairOrder[pairIndex];
            const [factorA, factorB] = PAIR_COMPARISONS[originalPairIndex];
            const selected = pairChoices[pairIndex];
            return (
              <>
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
                  {[factorA, factorB].map((factor, index) => (
                    <button
                      key={factor}
                      className={`grid min-h-48 cursor-pointer content-center whitespace-normal rounded-lg border p-6 text-center ${selected === factor
                        ? "border-4 border-gray-900 bg-gray-900 text-white"
                        : "border-gray-400 bg-white text-[#16181d] hover:border-gray-900"
                        }`}
                      type="button"
                      onClick={() => choosePair(factor)}
                    >
                      <span className={`mb-3 block text-sm font-bold ${selected === factor ? "text-white/80" : "text-gray-500"}`}>
                        項目{index + 1}
                      </span>
                      {PAIR_DESCRIPTIONS_JA[factor]}
                    </button>
                  ))}
                </div>
                <div className="mt-5 flex justify-between gap-3 max-[760px]:flex-col">
                  <button
                    className={secondaryButton}
                    type="button"
                    disabled={pairIndex === 0}
                    onClick={() => setPairIndex(pairIndex - 1)}
                  >
                    戻る
                  </button>
                  <button className={primaryButton} type="button" disabled={isSaving} onClick={nextPair}>
                    {pairIndex === PAIR_COMPARISONS.length - 1 ? "回答を完了する" : "次へ"}
                  </button>
                </div>
              </>
            );
          })()}
        </section>
      )}

      {step === "complete" && (
        <section className={`${panelBase} max-w-170`}>
          <h1 className="text-[clamp(1.7rem,3vw,2.35rem)]">回答が完了しました</h1>
          <p className="font-semibold text-emerald-700">3条件すべての回答が完了しました。ご回答ありがとうございました。</p>
          <div className="mt-5 flex justify-end gap-3">
            <button className={primaryButton} type="button" onClick={resetAll}>
              新しい回答を開始する
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
