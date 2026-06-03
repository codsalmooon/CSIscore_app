import { DataTable } from "@/components/admin/data-table";
import { Panel } from "@/components/ui/panel";

type SummaryPanelProps = {
  title: string;
  rows: Record<string, unknown>[];
};

export function SummaryPanel({ rows, title }: SummaryPanelProps) {
  return (
    <Panel>
      <h2 className="text-xl">{title}</h2>
      <DataTable rows={rows} />
    </Panel>
  );
}
