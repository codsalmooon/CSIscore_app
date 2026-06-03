"use client";

import { useMemo, useState } from "react";

type AdminSummary = {
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
  ["scores", "参加者IDとCSIスコアCSV"],
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
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [message, setMessage] = useState("");

  const participantOptions = useMemo(() => {
    const grouped = new Map<string, { participantId: string; responseCount: number }>();
    for (const row of responses) {
      const entry = grouped.get(row.participant_id) ?? { participantId: row.participant_id, responseCount: 0 };
      entry.responseCount += 1;
      grouped.set(row.participant_id, entry);
    }
    return [...grouped.values()].sort((a, b) => a.participantId.localeCompare(b.participantId));
  }, [responses]);

  async function loadAdminData(clearMessage = true) {
    if (clearMessage) {
      setMessage("");
    }
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
    const participantIds = [...new Set(responsesData.responses.map((row) => row.participant_id))].sort((a, b) =>
      a.localeCompare(b),
    );
    setSelectedParticipantId(participantIds[0] ?? "");
  }

  async function deleteSelectedParticipantResponses() {
    if (!selectedParticipantId) {
      return;
    }
    const response = await fetch(`/api/admin/participants/${encodeURIComponent(selectedParticipantId)}/responses`, {
      method: "DELETE",
      headers: { "X-CSI-Admin-Passcode": passcode },
    });
    if (!response.ok) {
      setMessage("参加者の回答を削除できませんでした。");
      return;
    }
    const data = (await response.json()) as { deleted?: number };
    setMessage(`${selectedParticipantId} の回答を ${data.deleted ?? 0} 件削除しました。`);
    await loadAdminData(false);
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
        <a className="text-[1.05rem] font-bold">
          研究者画面
        </a>

      </header>

      {!summary && (
        <section className={`${panelBase} max-w-[680px]`}>
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
            <button className={primaryButton} type="button" onClick={() => void loadAdminData()}>
              表示する
            </button>
          </div>
          {message && <div className="mx-auto mt-4 rounded-lg border border-gray-300 bg-[#fff8e8] px-4 py-3">{message}</div>}
        </section>
      )}

      {summary && (
        <>
          {message && <div className="mx-auto mb-4 rounded-lg border border-gray-300 bg-[#fff8e8] px-4 py-3">{message}</div>}

          <section className={`${panelBase} max-w-full`}>
            <h2 className="text-xl">削除操作</h2>
            {participantOptions.length === 0 ? (
              <p className="text-gray-500">削除できる回答はありません。</p>
            ) : (
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-3 max-[760px]:grid-cols-1">
                <select
                  className={inputClass}
                  value={selectedParticipantId}
                  onChange={(event) => setSelectedParticipantId(event.target.value)}
                >
                  {participantOptions.map((participant) => (
                    <option key={participant.participantId} value={participant.participantId}>
                      {participant.participantId} / {participant.responseCount} 件
                    </option>
                  ))}
                </select>
                <button className={secondaryButton} type="button" onClick={deleteSelectedParticipantResponses}>
                  参加者の回答をすべて削除
                </button>
              </div>
            )}
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
