import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "required" | "optional" | "success" | "warning" | "error";

const variants: Record<BadgeVariant, string> = {
  default: "border-slate-200 bg-slate-50 text-slate-600",
  required: "border-sky-200 bg-sky-50 text-sky-700",
  optional: "border-slate-200 bg-white text-slate-500",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
