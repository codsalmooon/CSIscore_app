"use client";

import { useMemo, useState } from "react";

type AdminSummary = {
  conditions: Record<string, unknown>[];
  participantCompletion: Record<string, unknown>[];
  conditionSummary: Record<string, unknown>[];
  factorSummary: Record<string, unknown>[];
};

type ResponseRow = {
  id: number;
  participant_id: string;
  condition_name: string;
  submitted_at: string;
};

const CSV_LINKS = [
  ["raw", "ローデータCSV"],
  ["items", "項目別CSV"],
  ["factors", "因子別CSV"],
  ["pairs", "ペア比較CSV"],
  ["conditions", "条件別集計CSV"],
] as const;

const buttonBase =
  "min-h-11 cursor-pointer rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = `${buttonBase} border-gray-400 bg-white text-[#16181d] hover:border-gray-900`;
const primaryButton = `${buttonBase} border-gray-900 bg-gray-900 text-white hover:bg-gray-700`;
const panelBase = "mx-auto mb-4 rounded-lg border border-gray-300 bg-white p-6 shadow-sm";
const inputClass = "min-h-11 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-[#16181d]";

function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  const headers = useMemo(() => (rows.length > 0 ? Object.keys(rows[0]) : []), [rows]);
  if (rows.length === 0) {
    return <p className="text-gray-500">データはありません。</p>;
  }
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full border-collapse whitespace-nowrap">
        <thead>
          <tr>
            {headers.map((header) => (
              <th className="border-b border-gray-300 bg-gray-100 px-3 py-2 text-left text-sm font-bold text-gray-500" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {headers.map((header) => (
                <td className="border-b border-gray-300 px-3 py-2 text-left" key={header}>
                  {String(row[header] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage() {
  const [passcode, setPasscode] = useState("");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [selectedResponseId, setSelectedResponseId] = useState("");
  const [message, setMessage] = useState("");

  async function loadAdminData() {
    setMessage("");
    const headers = { "X-CSI-Admin-Passcode": passcode };
    const [summaryResponse, responsesResponse] = await Promise.all([
      fetch("/api/admin/summary", { headers }),
      fetch("/api/admin/responses", { headers }),
    ]);
    if (!summaryResponse.ok || !responsesResponse.ok) {
      setSummary(null);
      setResponses([]);
      setMessage("研究者画面を表示するには正しいパスコードを入力してください。");
      return;
    }
    const summaryData = (await summaryResponse.json()) as AdminSummary;
    const responsesData = (await responsesResponse.json()) as { responses: ResponseRow[] };
    setSummary(summaryData);
    setResponses(responsesData.responses);
    setSelectedResponseId(responsesData.responses[0]?.id ? String(responsesData.responses[0].id) : "");
  }

  async function deleteSelectedResponse() {
    if (!selectedResponseId) {
      return;
    }
    const response = await fetch(`/api/admin/responses/${selectedResponseId}`, {
      method: "DELETE",
      headers: { "X-CSI-Admin-Passcode": passcode },
    });
    if (!response.ok) {
      setMessage("回答を削除できませんでした。");
      return;
    }
    setMessage("回答を削除しました。");
    await loadAdminData();
  }

  async function downloadCsv(kind: string) {
    const response = await fetch(`/api/admin/csv/${kind}`, {
      headers: { "X-CSI-Admin-Passcode": passcode },
    });
    if (!response.ok) {
      setMessage("CSVを出力できませんでした。");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const filename = response.headers
      .get("Content-Disposition")
      ?.match(/filename="([^"]+)"/)?.[1] ?? `csi_${kind}.csv`;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto w-[min(1120px,calc(100%_-_2rem))] px-0 pb-12 pt-4">
      <header className="flex items-center justify-between gap-4 pb-5 pt-2 max-[760px]:grid max-[760px]:items-stretch">
        <a className="text-[1.05rem] font-bold" href="/">
          研究者画面
        </a>
        <nav className="flex gap-1 max-[760px]:flex-wrap" aria-label="画面切り替え">
          <a className="rounded-lg border border-transparent px-3 py-2 text-gray-500 hover:border-gray-300 hover:text-[#16181d]" href="/">
            参加者回答
          </a>
          <a className="rounded-lg border border-transparent px-3 py-2 text-gray-500 hover:border-gray-300 hover:text-[#16181d]" href="/admin">
            研究者画面
          </a>
        </nav>
      </header>

      <section className={`${panelBase} max-w-[680px]`}>
        <h1 className="text-[clamp(1.7rem,3vw,2.35rem)]">研究者画面</h1>
        <p className="text-gray-500">このアプリの総合点は6因子版CSI（Collaboration項目N/A）です。</p>
        <label className="mt-4 grid gap-2">
          <span className="text-sm font-semibold text-gray-500">パスコード</span>
          <input
            className={inputClass}
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void loadAdminData();
              }
            }}
          />
        </label>
        <div className="mt-5 flex justify-end gap-3">
          <button className={primaryButton} type="button" onClick={loadAdminData}>
            表示する
          </button>
        </div>
        {message && <div className="mx-auto mt-4 rounded-lg border border-gray-300 bg-[#fff8e8] px-4 py-3">{message}</div>}
      </section>

      {summary && (
        <>
          <section className={`${panelBase} max-w-full`}>
            <h2 className="text-xl">条件一覧</h2>
            <DataTable rows={summary.conditions} />
          </section>

          <section className={`${panelBase} max-w-full`}>
            <h2 className="text-xl">削除操作</h2>
            {responses.length === 0 ? (
              <p className="text-gray-500">削除できる回答はありません。</p>
            ) : (
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-3 max-[760px]:grid-cols-1">
                <select className={inputClass} value={selectedResponseId} onChange={(event) => setSelectedResponseId(event.target.value)}>
                  {responses.map((row) => (
                    <option key={row.id} value={row.id}>
                      回答ID {row.id} / {row.participant_id} / {row.condition_name} / {row.submitted_at}
                    </option>
                  ))}
                </select>
                <button className={secondaryButton} type="button" onClick={deleteSelectedResponse}>
                  回答を削除
                </button>
              </div>
            )}
          </section>

          <section className={`${panelBase} max-w-full`}>
            <h2 className="text-xl">参加者別完了状況</h2>
            <DataTable rows={summary.participantCompletion} />
          </section>

          <section className={`${panelBase} max-w-full`}>
            <h2 className="text-xl">条件別集計</h2>
            <DataTable rows={summary.conditionSummary} />
          </section>

          <section className={`${panelBase} max-w-full`}>
            <h2 className="text-xl">因子別集計</h2>
            <DataTable rows={summary.factorSummary} />
          </section>

          <section className={`${panelBase} max-w-full`}>
            <h2 className="text-xl">CSV出力</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {CSV_LINKS.map(([kind, label]) => (
                <button className={secondaryButton} key={kind} type="button" onClick={() => downloadCsv(kind)}>
                  {label}
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
