import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Label({ className, children, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("block text-label font-bold uppercase text-muted", className)} {...rest}>
      {children}
    </label>
  );
}

export function Helper({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[12px] leading-[1.4] text-muted", className)}>{children}</p>;
}

export function ErrorText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn("text-[12px] leading-[1.4] font-semibold text-danger", className)}>
      {children}
    </p>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** Fixed text shown before the value, e.g. "+60" or "webbi.my/w/". */
  leading?: ReactNode;
}

export function Input({ className, invalid, leading, ...rest }: InputProps) {
  const inputClasses = cn(
    "h-[52px] w-full rounded-input border-[1.5px] bg-surface px-4 text-[16px] text-ink outline-none transition-[border-color,box-shadow] duration-150",
    "focus:border-navy focus:shadow-focus",
    invalid ? "border-danger" : "border-line-input",
    Boolean(leading) && "rounded-l-none border-l-0 pl-2",
    className,
  );
  if (!leading) return <input className={inputClasses} aria-invalid={invalid || undefined} {...rest} />;
  return (
    <div className="flex w-full">
      <span
        className={cn(
          "flex h-[52px] items-center rounded-l-input border-[1.5px] border-r-0 bg-ground pl-4 pr-1 text-[15px] text-muted whitespace-nowrap",
          invalid ? "border-danger" : "border-line-input",
        )}
      >
        {leading}
      </span>
      <input className={inputClasses} aria-invalid={invalid || undefined} {...rest} />
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  /** Larger "Start screen" styling (17px, 20px radius, 168px min-height). */
  large?: boolean;
}

export function Textarea({ className, invalid, large, ...rest }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full resize-y rounded-[20px] border-[1.5px] bg-surface text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-navy focus:shadow-focus",
        large ? "min-h-[168px] px-[18px] py-4 text-[17px] leading-[1.5]" : "min-h-[96px] px-4 py-3 text-[16px] leading-[1.5]",
        invalid ? "border-danger" : "border-line-input",
        className,
      )}
      {...rest}
    />
  );
}

/** Label + control + helper/error, stacked with the design's 8px gap. */
export function Field({
  label,
  htmlFor,
  helper,
  error,
  children,
  className,
}: {
  label?: ReactNode;
  htmlFor?: string;
  helper?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
      {error ? <ErrorText>{error}</ErrorText> : helper ? <Helper>{helper}</Helper> : null}
    </div>
  );
}
