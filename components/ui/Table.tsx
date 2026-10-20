import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * Pembungkus tabel: kartu + gulir horizontal yang bisa difokus keyboard.
 * Gunakan `aria-label` agar area gulir punya nama.
 */
export function TableWrap({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn("card overflow-x-auto focus-visible:outline-2 focus-visible:outline-brand-500", className)}
    >
      {children}
    </div>
  );
}

export function Table({
  caption,
  stickyHeader,
  className,
  children,
}: {
  /** Judul tabel untuk pembaca layar (disembunyikan secara visual). */
  caption?: string;
  stickyHeader?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <table className={cn("tbl", stickyHeader && "tbl-sticky", className)}>
      {caption && <caption className="sr-only">{caption}</caption>}
      {children}
    </table>
  );
}

export function Th({ numeric, className, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <th scope="col" className={cn(numeric && "tbl-num", className)} {...rest} />;
}

export function Td({ numeric, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td className={cn(numeric && "tbl-num", className)} {...rest} />;
}
