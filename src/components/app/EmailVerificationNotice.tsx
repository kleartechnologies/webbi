"use client";

import { useEffect, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { refreshVerification, resendVerification } from "@/lib/auth/actions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { authErrorCode, authErrorMessage } from "@/lib/auth/errors";
import { VERIFY_EMAIL_MESSAGE } from "@/lib/auth/publishing";
import { cn } from "@/lib/cn";

/** Seconds before "Resend email" can be pressed again. Firebase limits sends on its side as well. */
export const RESEND_COOLDOWN_S = 60;

/**
 * Tells an email/password owner their address isn't verified yet, lets them
 * resend the link and pick up the verification without signing out. Shown
 * only while `needsVerification` (never to Google accounts). The server makes
 * the decision; this only explains it.
 *
 * - publish: on the Publish screen, above a disabled Pay button.
 * - paid:    on the return page, when a payment came in before verification.
 * - banner:  the dashboard's quiet reminder.
 */
export function EmailVerificationNotice({
  variant = "publish",
  onVerified,
}: {
  variant?: "publish" | "paid" | "banner";
  onVerified?: () => void;
}) {
  const { user, needsVerification } = useAuth();
  const [busy, setBusy] = useState<"resend" | "refresh" | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (!user || (!needsVerification && variant !== "paid")) return null;

  const resend = async () => {
    if (busy || cooldown > 0) return;
    setBusy("resend");
    setError(null);
    setNotice(null);
    try {
      await resendVerification();
      setNotice(`We sent a new link to ${user.email ?? "your email"}.`);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (e) {
      setError(authErrorMessage(e));
      if (authErrorCode(e) === "auth/too-many-requests") setCooldown(RESEND_COOLDOWN_S);
    } finally {
      setBusy(null);
    }
  };

  const refresh = async () => {
    if (busy) return;
    setBusy("refresh");
    setError(null);
    setNotice(null);
    try {
      if (await refreshVerification()) onVerified?.();
      else setError("We can't see the verification yet. Open the link in the email, then try again.");
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const banner = variant === "banner";

  return (
    <section
      role="status"
      data-email-verification={variant}
      className={cn(
        "flex flex-col gap-3 rounded-card border px-4 py-[14px]",
        banner ? "border-line bg-surface" : "border-amber/60 bg-amber/10",
      )}
    >
      <div className="flex items-start gap-3">
        <Icon name="mail" size={22} className="mt-0.5 flex-none text-navy" />
        <div className="flex min-w-0 flex-col gap-1">
          <strong className="text-[14px] leading-[1.35]">
            {banner ? "Verify your email to publish" : VERIFY_EMAIL_MESSAGE}
          </strong>
          <p className="text-[13px] leading-[1.45] text-muted">
            {variant === "paid"
              ? "Your payment is safe and you won't be charged again. Open the link we sent, then come back and press Pay once more to publish."
              : `We sent a link to ${user.email ?? "your email"}. You can keep building and previewing while you wait.`}
          </p>
        </div>
      </div>
      {needsVerification ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" loading={busy === "refresh"} disabled={busy !== null} onClick={() => void refresh()}>
            I&apos;ve verified
          </Button>
          <Button
            size="sm"
            variant="outline"
            loading={busy === "resend"}
            disabled={busy !== null || cooldown > 0}
            onClick={() => void resend()}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
          </Button>
        </div>
      ) : null}
      {notice ? <p className="text-[13px] font-semibold text-success">{notice}</p> : null}
      {error ? (
        <p role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
