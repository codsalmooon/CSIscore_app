"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CsvExportPanel } from "@/components/admin/csv-export-panel";
import { DeleteResponsesPanel } from "@/components/admin/delete-responses-panel";
import { MergeParticipantsPanel } from "@/components/admin/merge-participants-panel";
import { PasscodePanel } from "@/components/admin/passcode-panel";
import { SummaryPanel } from "@/components/admin/summary-panel";
import { MessageBox } from "@/components/ui/message-box";
import { PageShell } from "@/components/ui/page-shell";

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
  ["raw", "生データ"],
  ["scores", "参加者IDと各条件のCSIスコア"],
] as const;

export default function AdminPage() {
  const [passcode, setPasscode] = useState("");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [mergeSourceParticipantId, setMergeSourceParticipantId] = useState("");
  const [mergeTargetParticipantId, setMergeTargetParticipantId] = useState("");
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
    setMergeSourceParticipantId(participantIds[0] ?? "");
    setMergeTargetParticipantId(participantIds[1] ?? participantIds[0] ?? "");
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

  async function mergeParticipantResponses() {
    const response = await fetch("/api/admin/participants/merge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSI-Admin-Passcode": passcode,
      },
      body: JSON.stringify({
        sourceParticipantId: mergeSourceParticipantId,
        targetParticipantId: mergeTargetParticipantId,
      }),
    });
    const data = (await response.json()) as { updated?: number; deleted?: number; error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "IDを統合できませんでした。");
      return;
    }
    setMessage(
      `${mergeSourceParticipantId} の回答を ${mergeTargetParticipantId} に ${data.updated ?? 0} 件統合しました。重複回答を ${
        data.deleted ?? 0
      } 件削除しました。`,
    );
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
    <PageShell title="研究者画面">
      <div className="mb-4 flex justify-end">
        <Link
          className="inline-flex min-h-11 items-center rounded-lg border border-gray-400 bg-white px-4 py-2 text-[#16181d] hover:border-gray-900"
          href="/sandbox"
        >
          入力部品サンドボックス
        </Link>
      </div>

      {!summary && (
        <PasscodePanel
          message={message}
          passcode={passcode}
          onPasscodeChange={setPasscode}
          onSubmit={() => void loadAdminData()}
        />
      )}

      {summary && (
        <>
          {message && <MessageBox>{message}</MessageBox>}
          <DeleteResponsesPanel
            participants={participantOptions}
            selectedParticipantId={selectedParticipantId}
            onDelete={deleteSelectedParticipantResponses}
            onSelectParticipant={setSelectedParticipantId}
          />
          <MergeParticipantsPanel
            sourceParticipantId={mergeSourceParticipantId}
            targetParticipantId={mergeTargetParticipantId}
            onMerge={mergeParticipantResponses}
            onSourceParticipantChange={setMergeSourceParticipantId}
            onTargetParticipantChange={setMergeTargetParticipantId}
          />
          <SummaryPanel rows={summary.conditionSummary} title="条件別集計" />
          <SummaryPanel rows={summary.factorSummary} title="因子別集計" />
          <CsvExportPanel links={CSV_LINKS} onDownload={downloadCsv} />
        </>
      )}
    </PageShell>
  );
}
