import { useMemo } from "react";

type DataTableProps = {
  rows: Record<string, unknown>[];
};

export function DataTable({ rows }: DataTableProps) {
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
