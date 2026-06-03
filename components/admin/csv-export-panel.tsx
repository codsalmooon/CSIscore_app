import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

type CsvLink = readonly [kind: string, label: string];

type CsvExportPanelProps = {
  links: readonly CsvLink[];
  onDownload: (kind: string) => void;
};

export function CsvExportPanel({ links, onDownload }: CsvExportPanelProps) {
  return (
    <Panel>
      <h2 className="text-xl">CSV出力</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {links.map(([kind, label]) => (
          <Button key={kind} type="button" onClick={() => onDownload(kind)}>
            {label}
          </Button>
        ))}
      </div>
    </Panel>
  );
}
