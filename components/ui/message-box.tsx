import { HTMLAttributes } from "react";
import { cn } from "@/lib/classNames";

type MessageTone = "neutral" | "error";

type MessageBoxProps = HTMLAttributes<HTMLDivElement> & {
  tone?: MessageTone;
  width?: "default" | "narrow";
};

const toneClasses: Record<MessageTone, string> = {
  neutral: "border-gray-300 text-[#16181d]",
  error: "border-red-300 text-red-700",
};

const widthClasses: Record<NonNullable<MessageBoxProps["width"]>, string> = {
  default: "",
  narrow: "max-w-[680px]",
};

export function MessageBox({ className, tone = "neutral", width = "default", ...props }: MessageBoxProps) {
  return (
    <div
      className={cn("mx-auto mb-4 rounded-lg border bg-[#fff8e8] px-4 py-3", toneClasses[tone], widthClasses[width], className)}
      {...props}
    />
  );
}
