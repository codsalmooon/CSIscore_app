import { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/classNames";

type FieldProps = LabelHTMLAttributes<HTMLLabelElement> & {
  label: string;
};

const controlClass = "min-h-11 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-[#16181d]";

export function Field({ children, className, label, ...props }: FieldProps) {
  return (
    <label className={cn("mt-4 grid gap-2", className)} {...props}>
      <span className="text-sm font-semibold text-gray-500">{label}</span>
      {children}
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...props} />;
}

export function SelectInput({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlClass, className)} {...props} />;
}
