"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ITEMS,
  PAIR_COMPARISONS,
  PAIR_DESCRIPTIONS_JA,
  Factor,
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
      if (parsed.participantId) {
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
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          CSI回答フォーム
        </a>
        <nav className="nav-links" aria-label="画面切り替え">
          <a href="/">参加者回答</a>
          <a href="/admin">研究者画面</a>
        </nav>
      </header>

      {message && <div className="notice error">{message}</div>}

      {step === "condition" && (
        <section className="panel narrow">
          <h1>回答条件の選択</h1>
          <label className="field">
            <span>ID</span>
            <input value={session.participantId} disabled />
          </label>
          <div className="completion-line">
            回答済み: {session.completedConditionIds.length} / {conditions.length || 3}
          </div>
          <label className="field">
            <span>入力する回答を選択</span>
            <select
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
          <div className="actions end">
            <button className="primary" type="button" onClick={startItems}>
              評価へ進む
            </button>
          </div>
        </section>
      )}

      {step === "items" && (
        <section className="panel wide">
          <div className="section-heading">
            <h1>10段階評価</h1>
            <span>{selectedCondition?.name}</span>
          </div>
          <div className="items-list">
            {ITEMS.map((item) => {
              const value = item.scoreable ? itemScores[item.id] ?? 5 : 0;
              return (
                <div className="rating-row" key={item.id}>
                  <p>{item.textJa}</p>
                  <div className="slider-grid">
                    <span>まったくそう思わない</span>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={value}
                      disabled={!item.scoreable}
                      onChange={(event) =>
                        setItemScores({ ...itemScores, [item.id]: Number(event.target.value) })
                      }
                    />
                    <span>とてもそう思う</span>
                    <strong>{item.scoreable ? value : "N/A"}</strong>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="actions between">
            <button type="button" onClick={() => setStep("condition")}>
              戻る
            </button>
            <button className="primary" type="button" onClick={startPairs}>
              ペア比較へ進む
            </button>
          </div>
        </section>
      )}

      {step === "pairs" && pairOrder.length > 0 && (
        <section className="panel wide">
          {(() => {
            const originalPairIndex = pairOrder[pairIndex];
            const [factorA, factorB] = PAIR_COMPARISONS[originalPairIndex];
            const selected = pairChoices[pairIndex];
            return (
              <>
                <div className="section-heading">
                  <h1>
                    ペア比較 {pairIndex + 1} / {PAIR_COMPARISONS.length}
                  </h1>
                  <span>このタスクを行ううえで、より重要だったものを選んでください。</span>
                </div>
                <div className="progress">
                  <div style={{ width: `${((pairIndex + 1) / PAIR_COMPARISONS.length) * 100}%` }} />
                </div>
                <div className="pair-grid">
                  {[factorA, factorB].map((factor, index) => (
                    <button
                      key={factor}
                      className={`pair-card ${selected === factor ? "selected" : ""}`}
                      type="button"
                      onClick={() => choosePair(factor)}
                    >
                      <span>項目{index + 1}</span>
                      {PAIR_DESCRIPTIONS_JA[factor]}
                    </button>
                  ))}
                </div>
                <div className="actions between">
                  <button type="button" disabled={pairIndex === 0} onClick={() => setPairIndex(pairIndex - 1)}>
                    戻る
                  </button>
                  <button className="primary" type="button" disabled={isSaving} onClick={nextPair}>
                    {pairIndex === PAIR_COMPARISONS.length - 1 ? "回答を完了する" : "次へ"}
                  </button>
                </div>
              </>
            );
          })()}
        </section>
      )}

      {step === "complete" && (
        <section className="panel narrow">
          <h1>回答が完了しました</h1>
          <p className="success-text">3条件すべての回答が完了しました。ご回答ありがとうございました。</p>
          <div className="actions end">
            <button className="primary" type="button" onClick={resetAll}>
              新しい回答を開始する
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
