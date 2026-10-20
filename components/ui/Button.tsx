import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Spinner } from "./Feedback";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "danger-solid";
export type ButtonSize = "sm" | "md" | "lg";

// Nama kelas ditulis UTUH (bukan dirakit dari template string) supaya Tailwind
// tidak membuangnya saat purge. Jangan diubah menjadi `btn-${variant}`.
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  accent: "btn-accent",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
  "danger-solid": "btn-danger-solid",
};
const SIZE_CLASS: Record<ButtonSize, string> = { sm: "btn-sm", md: "", lg: "btn-lg" };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Menonaktifkan tombol dan menampilkan spinner (mencegah klik ganda). */
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/**
 * Tombol standar. Gaya ada di globals.css (.btn*) sehingga tombol lama berkelas
 * `btn btn-primary` otomatis tampil sama.
 * PERHATIAN: `type` bawaan = "button". Untuk tombol kirim formulir tulis type="submit".
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, leftIcon, rightIcon, className, disabled, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn("btn", VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      {...rest}
    >
      {loading ? <Spinner /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Wajib: nama aksi untuk pembaca layar dan tooltip bawaan. */
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = "ghost", size = "md", loading = false, className, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-label={label}
      title={label}
      aria-busy={loading || undefined}
      className={cn("btn btn-icon", VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
    </button>
  );
});
