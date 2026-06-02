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

function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  const headers = useMemo(() => (rows.length > 0 ? Object.keys(rows[0]) : []), [rows]);
  if (rows.length === 0) {
    return <p className="muted">データはありません。</p>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {headers.map((header) => (
                <td key={header}>{String(row[header] ?? "")}</td>
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
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          研究者画面
        </a>
        <nav className="nav-links" aria-label="画面切り替え">
          <a href="/">参加者回答</a>
          <a href="/admin">研究者画面</a>
        </nav>
      </header>

      <section className="panel narrow">
        <h1>研究者画面</h1>
        <p className="muted">このアプリの総合点は6因子版CSI（Collaboration項目N/A）です。</p>
        <label className="field">
          <span>パスコード</span>
          <input
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
        <div className="actions end">
          <button className="primary" type="button" onClick={loadAdminData}>
            表示する
          </button>
        </div>
        {message && <div className="notice">{message}</div>}
      </section>

      {summary && (
        <>
          <section className="panel wide">
            <h2>条件一覧</h2>
            <DataTable rows={summary.conditions} />
          </section>

          <section className="panel wide">
            <h2>削除操作</h2>
            {responses.length === 0 ? (
              <p className="muted">削除できる回答はありません。</p>
            ) : (
              <div className="delete-row">
                <select value={selectedResponseId} onChange={(event) => setSelectedResponseId(event.target.value)}>
                  {responses.map((row) => (
                    <option key={row.id} value={row.id}>
                      回答ID {row.id} / {row.participant_id} / {row.condition_name} / {row.submitted_at}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={deleteSelectedResponse}>
                  回答を削除
                </button>
              </div>
            )}
          </section>

          <section className="panel wide">
            <h2>参加者別完了状況</h2>
            <DataTable rows={summary.participantCompletion} />
          </section>

          <section className="panel wide">
            <h2>条件別集計</h2>
            <DataTable rows={summary.conditionSummary} />
          </section>

          <section className="panel wide">
            <h2>因子別集計</h2>
            <DataTable rows={summary.factorSummary} />
          </section>

          <section className="panel wide">
            <h2>CSV出力</h2>
            <div className="csv-grid">
              {CSV_LINKS.map(([kind, label]) => (
                <button key={kind} type="button" onClick={() => downloadCsv(kind)}>
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
