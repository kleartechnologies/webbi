import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "whatsapp" | "amber" | "outline" | "danger";
export type ButtonSize = "lg" | "md" | "sm";

interface StyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width. */
  block?: boolean;
  icon?: IconName;
  iconFill?: boolean;
  iconPosition?: "left" | "right";
  loading?: boolean;
}

const base =
  "inline-flex items-center justify-center rounded-pill font-bold whitespace-nowrap select-none transition-[background-color,border-color,opacity,transform] duration-150 active:scale-[0.99] disabled:opacity-45 disabled:pointer-events-none aria-disabled:opacity-45 aria-disabled:pointer-events-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-navy text-white hover:bg-navy-hover",
  secondary: "bg-surface text-ink border-[1.5px] border-line-input hover:border-navy",
  ghost: "text-navy hover:bg-navy-tint",
  whatsapp: "bg-whatsapp text-white hover:bg-whatsapp-hover",
  amber: "bg-amber text-ink hover:brightness-95",
  outline: "bg-transparent text-current border-[1.5px] border-current hover:bg-black/5",
  danger: "bg-danger-tint text-danger hover:bg-danger hover:text-white",
};

const sizes: Record<ButtonSize, string> = {
  lg: "h-[54px] px-6 text-[16px] gap-2",
  md: "h-11 px-5 text-[14px] gap-2",
  sm: "h-9 px-4 text-[13px] gap-1.5",
};

function resolve(style: StyleProps, className?: string) {
  const variant = style.variant ?? "primary";
  const size = style.size ?? (variant === "ghost" || variant === "outline" ? "md" : "lg");
  const classes = cn(
    base,
    variants[variant],
    sizes[size],
    variant === "whatsapp" && size === "lg" && "text-[17px] gap-[10px]",
    style.block && "w-full",
    className,
  );
  const iconSize = variant === "whatsapp" ? 24 : size === "sm" ? 18 : 20;
  return { classes, iconSize };
}

function Content({ style, iconSize, children }: { style: StyleProps; iconSize: number; children?: ReactNode }) {
  const position = style.iconPosition ?? "right";
  const node = style.loading ? (
    <Spinner size={iconSize} />
  ) : style.icon ? (
    <Icon name={style.icon} size={iconSize} fill={style.iconFill} />
  ) : null;
  return (
    <>
      {position === "left" && node}
      {children}
      {position === "right" && node}
    </>
  );
}

export interface ButtonProps extends StyleProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  type?: "button" | "submit" | "reset";
}

export function Button({
  variant, size, block, icon, iconFill, iconPosition, loading,
  type = "button", disabled, className, children, ...rest
}: ButtonProps) {
  const style = { variant, size, block, icon, iconFill, iconPosition, loading };
  const { classes, iconSize } = resolve(style, className);
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={classes} {...rest}>
      <Content style={style} iconSize={iconSize}>{children}</Content>
    </button>
  );
}

export interface ButtonLinkProps extends StyleProps, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  disabled?: boolean;
  prefetch?: boolean;
  /** Load the destination as a new document instead of navigating client-side. */
  fullLoad?: boolean;
}

/** Same look as Button, rendered as a link (internal via next/link, external or full-load via <a>). */
export function ButtonLink({
  variant, size, block, icon, iconFill, iconPosition, loading,
  href, disabled, prefetch, fullLoad, target, rel, className, children, ...rest
}: ButtonLinkProps) {
  const style = { variant, size, block, icon, iconFill, iconPosition, loading };
  const { classes, iconSize } = resolve(style, className);
  const content = <Content style={style} iconSize={iconSize}>{children}</Content>;
  if (disabled) {
    return (
      <span aria-disabled="true" className={classes}>
        {content}
      </span>
    );
  }
  const external = /^(https?:|mailto:|tel:)/.test(href);
  if (external || fullLoad) {
    return (
      <a href={href} target={target} rel={rel ?? (target === "_blank" ? "noopener noreferrer" : undefined)} className={classes} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} prefetch={prefetch} target={target} rel={rel} className={classes} {...rest}>
      {content}
    </Link>
  );
}
