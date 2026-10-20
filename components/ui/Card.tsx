import type { ElementType, ReactNode } from "react";
import { cn } from "./cn";

export function Card({
  as: Tag = "div",
  padded = true,
  className,
  children,
}: {
  as?: ElementType;
  padded?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return <Tag className={cn("card", padded && "p-5 sm:p-6", className)}>{children}</Tag>;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-heading text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-body text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
