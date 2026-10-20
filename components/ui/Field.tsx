import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

interface ShellProps {
  id: string;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label + pesan bantuan/galat. Dipakai Input/Select/Textarea, atau langsung untuk kontrol kustom. */
export function FieldGroup({ id, label, hint, error, required, className, children }: ShellProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
          {required && (
            <span className="ml-0.5 text-danger-600" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-caption text-danger-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-caption text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string, extra?: string) {
  const own = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return [extra, own].filter(Boolean).join(" ") || undefined;
}

interface BaseFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  /** Kelas untuk pembungkus (bukan untuk elemen isian). */
  wrapperClassName?: string;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, BaseFieldProps {
  /** Teks awalan di dalam kotak, mis. "Rp". */
  leading?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, wrapperClassName, leading, className, id: idProp, required, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldGroup id={id} label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-medium text-slate-500">
            {leading}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint, rest["aria-describedby"])}
          className={cn("field", leading && "pl-10", className)}
          {...rest}
        />
      </div>
    </FieldGroup>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, BaseFieldProps {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, wrapperClassName, className, id: idProp, required, children, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldGroup id={id} label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      <select
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint, rest["aria-describedby"])}
        className={cn("field", className)}
        {...rest}
      >
        {children}
      </select>
    </FieldGroup>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, BaseFieldProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, wrapperClassName, className, id: idProp, required, rows = 3, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldGroup id={id} label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint, rest["aria-describedby"])}
        className={cn("field resize-y", className)}
        {...rest}
      />
    </FieldGroup>
  );
});
