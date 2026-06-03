import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/classNames";

type ButtonVariant = "primary" | "secondary";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const baseClass = "min-h-11 cursor-pointer rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "border-gray-900 bg-gray-900 text-white hover:bg-gray-700",
  secondary: "border-gray-400 bg-white text-[#16181d] hover:border-gray-900",
};

export function Button({ className, variant = "secondary", ...props }: ButtonProps) {
  return <button className={cn(baseClass, variantClasses[variant], className)} {...props} />;
}
