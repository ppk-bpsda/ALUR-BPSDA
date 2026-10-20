import { cloneElement, useId, type ReactElement } from "react";
import { cn } from "./cn";

/**
 * Tooltip murni CSS (tanpa JS): muncul saat hover atau fokus keyboard.
 * `children` harus satu elemen (mis. IconButton); aria-describedby dipasang otomatis.
 */
export function Tooltip({
  text,
  side = "top",
  children,
}: {
  text: string;
  side?: "top" | "bottom";
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  return (
    <span className="group relative inline-flex">
      {cloneElement(children, { "aria-describedby": id })}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lift transition-opacity duration-fast",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        {text}
      </span>
    </span>
  );
}
