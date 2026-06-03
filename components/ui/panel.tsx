import { HTMLAttributes } from "react";
import { cn } from "@/lib/classNames";

type PanelWidth = "narrow" | "wide";

type PanelProps = HTMLAttributes<HTMLElement> & {
  width?: PanelWidth;
};

const widthClasses: Record<PanelWidth, string> = {
  narrow: "max-w-[680px]",
  wide: "max-w-full",
};

export function Panel({ className, width = "wide", ...props }: PanelProps) {
  return (
    <section
      className={cn("mx-auto mb-4 rounded-lg border border-gray-300 bg-white p-6 shadow-sm", widthClasses[width], className)}
      {...props}
    />
  );
}
