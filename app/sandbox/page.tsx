"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ItemRatingStep } from "@/components/participant/item-rating-step";
import { PairComparisonStep } from "@/components/participant/pair-comparison-step";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MessageBox } from "@/components/ui/message-box";
import { PageShell } from "@/components/ui/page-shell";
import { Panel } from "@/components/ui/panel";
import { Factor, ITEMS, PAIR_COMPARISONS } from "@/lib/csi";
import { cn } from "@/lib/classNames";

const DEMO_PAIR_ORDER = Array.from({ length: PAIR_COMPARISONS.length }, (_, index) => index);
const QUESTIONNAIRE_OPTIONS = ["とても低い", "低い", "どちらでもない", "高い", "とても高い"];
const CHECKBOX_OPTIONS = ["操作しやすさ", "表示のわかりやすさ", "回答時間", "質問文の自然さ"];

type SandboxView = "overview" | "csi-items" | "csi-pairs";

function initialItemScores(): Record<string, number> {
  return Object.fromEntries(ITEMS.filter((item) => item.scoreable).map((item) => [item.id, 5]));
}

export default function SandboxPage() {
  const [view, setView] = useState<SandboxView>("overview");
  const [itemScores, setItemScores] = useState<Record<string, number>>(() => initialItemScores());
  const [pairChoices, setPairChoices] = useState<Factor[]>(Array(PAIR_COMPARISONS.length).fill(null));
  const [pairIndex, setPairIndex] = useState(0);
  const [questionnaireScore, setQuestionnaireScore] = useState(5);
  const [singleChoice, setSingleChoice] = useState(QUESTIONNAIRE_OPTIONS[2]);
  const [checkedItems, setCheckedItems] = useState<string[]>([CHECKBOX_OPTIONS[0]]);
  const [freeText, setFreeText] = useState("回答欄の入力動作を確認できます。");
  const [message, setMessage] = useState("");

  const selectedPairCount = useMemo(() => pairChoices.filter(Boolean).length, [pairChoices]);

  function resetCsiItems() {
    setItemScores(initialItemScores());
  }

  function choosePair(choice: Factor) {
    const nextChoices = [...pairChoices];
    nextChoices[pairIndex] = choice;
    setPairChoices(nextChoices);
    setMessage("");
  }

  function nextPair() {
    if (!pairChoices[pairIndex]) {
      setMessage("比較対象を1つ選択してください。");
      return;
    }
    setMessage("");
    if (pairIndex === PAIR_COMPARISONS.length - 1) {
      setView("overview");
      setMessage("ペア比較の最後まで進みました。保存は行っていません。");
      return;
    }
    setPairIndex(pairIndex + 1);
  }

  function resetPairs() {
    setPairChoices(Array(PAIR_COMPARISONS.length).fill(null));
    setPairIndex(0);
    setMessage("");
  }

  function toggleCheckedItem(option: string) {
    setCheckedItems((current) =>
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option],
    );
  }

  return (
    <PageShell title="入力部品サンドボックス">
      <div className="mb-4 flex justify-end">
        <Link
          className="inline-flex min-h-11 items-center rounded-lg border border-gray-400 bg-white px-4 py-2 text-[#16181d] hover:border-gray-900"
          href="/admin"
        >
          研究者画面へ戻る
        </Link>
      </div>

      {message && <MessageBox>{message}</MessageBox>}

      {view === "overview" && (
        <>
          <Panel>
            <div className="flex items-start justify-between gap-4 max-[760px]:grid">
              <div>
                <h2 className="text-xl">CSI入力コンポーネント</h2>
                <p className="mt-3 text-gray-600">
                  実際の回答フローを進めずに、スライダーとペア比較の操作状態を確認できます。
                </p>
              </div>
              <div className="flex gap-3 max-[760px]:grid">
                <Button type="button" onClick={() => setView("csi-items")}>
                  10段階評価を確認
                </Button>
                <Button type="button" onClick={() => setView("csi-pairs")}>
                  ペア比較を確認
                </Button>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 text-sm max-[760px]:grid-cols-1">
              <div className="rounded-lg border border-gray-300 p-4">
                <span className="font-semibold text-gray-500">評価項目</span>
                <p className="mt-2 text-2xl font-bold">{Object.keys(itemScores).length} 項目</p>
              </div>
              <div className="rounded-lg border border-gray-300 p-4">
                <span className="font-semibold text-gray-500">ペア比較の選択済み数</span>
                <p className="mt-2 text-2xl font-bold">
                  {selectedPairCount} / {PAIR_COMPARISONS.length}
                </p>
              </div>
            </div>
          </Panel>

          <Panel>
            <h2 className="text-xl">事後質問紙コンポーネント</h2>
            <div className="mt-6 grid gap-8">
              <section>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-semibold">0-10段階スライダー</h3>
                  <strong>{questionnaireScore}</strong>
                </div>
                <input
                  className="mt-3 w-full accent-gray-900"
                  type="range"
                  min="0"
                  max="10"
                  value={questionnaireScore}
                  aria-label="事後質問紙の10段階評価"
                  onChange={(event) => setQuestionnaireScore(Number(event.target.value))}
                />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>低い</span>
                  <span>高い</span>
                </div>
              </section>

              <section>
                <h3 className="font-semibold">単一選択</h3>
                <div className="mt-3 grid grid-cols-5 gap-2 max-[760px]:grid-cols-1">
                  {QUESTIONNAIRE_OPTIONS.map((option) => {
                    const selected = singleChoice === option;
                    return (
                      <button
                        className={cn(
                          "min-h-11 rounded-lg border px-3 py-2",
                          selected
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-400 bg-white text-[#16181d] hover:border-gray-900",
                        )}
                        key={option}
                        type="button"
                        onClick={() => setSingleChoice(option)}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 className="font-semibold">複数選択</h3>
                <div className="mt-3 grid grid-cols-4 gap-2 max-[760px]:grid-cols-1">
                  {CHECKBOX_OPTIONS.map((option) => (
                    <label
                      className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-400 bg-white px-3 py-2"
                      key={option}
                    >
                      <input
                        type="checkbox"
                        checked={checkedItems.includes(option)}
                        onChange={() => toggleCheckedItem(option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </section>

              <Field label="自由記述">
                <textarea
                  className="min-h-32 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-[#16181d]"
                  value={freeText}
                  onChange={(event) => setFreeText(event.target.value)}
                />
              </Field>
            </div>
          </Panel>
        </>
      )}

      {view === "csi-items" && (
        <>
          <ItemRatingStep
            conditionName="サンドボックス条件"
            itemScores={itemScores}
            onBack={() => setView("overview")}
            onNext={() => {
              setView("overview");
              setMessage("10段階評価の確認を終了しました。保存は行っていません。");
            }}
            onScoreChange={(itemId, score) => setItemScores({ ...itemScores, [itemId]: score })}
          />
          <div className="mx-auto flex max-w-full justify-end">
            <Button type="button" onClick={resetCsiItems}>
              初期値に戻す
            </Button>
          </div>
        </>
      )}

      {view === "csi-pairs" && (
        <>
          <div className="mb-4 flex justify-end">
            <Button type="button" onClick={() => setView("overview")}>
              一覧へ戻る
            </Button>
          </div>
          <PairComparisonStep
            isSaving={false}
            pairChoices={pairChoices}
            pairIndex={pairIndex}
            pairOrder={DEMO_PAIR_ORDER}
            onBack={() => {
              if (pairIndex === 0) {
                setView("overview");
                return;
              }
              setPairIndex(pairIndex - 1);
            }}
            onChoose={choosePair}
            onNext={nextPair}
          />
          <div className="mx-auto flex max-w-full justify-end">
            <Button type="button" onClick={resetPairs}>
              選択をリセット
            </Button>
          </div>
        </>
      )}
    </PageShell>
  );
}
