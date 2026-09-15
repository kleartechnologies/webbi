"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppPage } from "@/components/app/AppHeader";
import { FooterNote, StickyFooter } from "@/components/app/FlowChrome";
import { EmailVerificationNotice } from "@/components/app/EmailVerificationNotice";
import { RequireAuth } from "@/components/app/RequireAuth";
import { SiteMissing } from "@/components/app/SiteMissing";
import { Button, Field, Icon, Input, Spinner, type IconName } from "@/components/ui";
import { ApiError, callApi, errorMessage } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/cn";
import { PRICE_LABEL } from "@/lib/env";
import { siteHost } from "@/lib/site/flow";
import type { SlugCheck } from "@/lib/site/publish";
import { isReservedSlug, isValidSlug, slugify } from "@/lib/site/slug";
import type { Site } from "@/lib/site/types";
import { useSite } from "@/lib/site/useSite";

/** Step 08 in the design: choose the link, see the price, pay once. */
export function PublishView({ siteId }: { siteId: string }) {
  const site = useSite(siteId);
  return (
    <RequireAuth>
      <AppPage>
        {site === undefined ? (
          <div className="flex flex-1 items-center justify-center py-24 text-navy">
            <Spinner size={28} />
          </div>
        ) : site === null ? (
          <SiteMissing />
        ) : (
          <Suspense fallback={null}>
            <Publish site={site} />
          </Suspense>
        )}
      </AppPage>
    </RequireAuth>
  );
}

type RemoteCheck =
  | { slug: string; kind: "result"; check: SlugCheck; paymentsConfigured: boolean }
  | { slug: string; kind: "error"; message: string; code: string };

const INCLUDED = [
  `Live at your ${siteHost()} link`,
  "Unlimited edits and republishing",
  "WhatsApp, call and enquiry buttons",
  "QR code for your shop and flyers",
  "Hosting and mobile optimisation included",
];

const METHODS: { icon: IconName; label: string }[] = [
  { icon: "account_balance", label: "FPX Online Banking" },
  { icon: "credit_card", label: "Credit / Debit Card" },
  { icon: "wallet", label: "GrabPay" },
];

/** Keystroke-friendly normalisation: keeps a trailing dash while typing. */
function typedSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, 40);
}

function Publish({ site }: { site: Site }) {
  const router = useRouter();
  const params = useSearchParams();
  const { status, needsVerification } = useAuth();
  const draft = site.draft;
  const cancelled = params.get("cancelled") === "1";

  const [slug, setSlug] = useState(() => site.slug ?? slugify(draft?.business.name ?? ""));
  const [remote, setRemote] = useState<RemoteCheck | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  /** Checkout said email_unverified for a payment that is already in (held until the owner verifies). */
  const [unverifiedByServer, setUnverifiedByServer] = useState(false);

  // A live site goes to its Live screen.
  useEffect(() => {
    if (site.status === "published") router.replace(`/s/${site.id}/live`);
    else if (!draft) router.replace(`/s/${site.id}/confirm`);
  }, [site.id, site.status, draft, router]);

  // What we can tell without asking the server. A slug that is merely
  // unfinished (too short, or ending in the dash being typed) gets no error.
  const unfinished = slug.length < 3 || slug.endsWith("-");
  const local: SlugCheck | null = !slug
    ? null
    : !isValidSlug(slug)
      ? { slug, status: unfinished ? "incomplete" : "invalid" }
      : isReservedSlug(slug)
        ? { slug, status: "reserved" }
        : null;
  const needsRemote = Boolean(slug) && !local;
  const remoteForSlug = remote?.slug === slug ? remote : null;
  const checking = needsRemote && !remoteForSlug;

  // Debounced availability check against the server-only slug registry.
  useEffect(() => {
    if (status !== "account" || !needsRemote || remoteForSlug) return;
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const { paymentsConfigured, ...check } = await callApi<SlugCheck & { paymentsConfigured: boolean }>(
          "/api/publish/slug",
          { siteId: site.id, slug },
        );
        if (!stale) setRemote({ slug, kind: "result", check, paymentsConfigured });
      } catch (error) {
        if (stale) return;
        setRemote({
          slug,
          kind: "error",
          message: errorMessage(error, "We couldn't check that link. Try again."),
          code: error instanceof ApiError ? error.code : "unknown",
        });
      }
    }, 350);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [slug, site.id, status, needsRemote, remoteForSlug]);

  if (status !== "account" || site.status === "published" || !draft) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-navy">
        <Spinner size={28} />
      </div>
    );
  }

  const check = local ?? (remoteForSlug?.kind === "result" ? remoteForSlug.check : null);
  const remoteError = remoteForSlug?.kind === "error" ? remoteForSlug : null;
  const usable = check?.status === "available" || check?.status === "yours";
  const blocked = remoteError?.code === "admin_not_configured";
  const paymentsConfigured = remote?.kind === "result" ? remote.paymentsConfigured : null;
  const notConfigured = paymentsConfigured === false || blocked;

  const pay = async () => {
    if (!usable || paying || needsVerification) return;
    setPaying(true);
    setPayError(null);
    try {
      const { url } = await callApi<{ url: string }>("/api/publish/checkout", { siteId: site.id, slug });
      window.location.assign(url);
    } catch (error) {
      // The server's word on verification wins over this page's (possibly stale) token.
      // A payment already taken gets the reassuring "paid" notice; otherwise the plain verification message.
      const heldPayment = error instanceof ApiError && error.code === "email_unverified" && error.details.paid === true;
      setPayError(heldPayment ? null : errorMessage(error));
      if (heldPayment) setUnverifiedByServer(true);
      setPaying(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 px-3 pt-1">
        <button
          type="button"
          onClick={() => router.push(`/s/${site.id}/ready`)}
          aria-label="Back to preview"
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-[#EDEBE5]"
        >
          <Icon name="arrow_back" size={24} />
        </button>
        <h1 className="text-[22px] leading-none tracking-[-0.02em]">Publish</h1>
      </div>

      <div className="flex flex-1 flex-col gap-[22px] px-5 pt-4">
        {cancelled ? (
          <p className="rounded-input bg-navy-tint px-4 py-3 text-[13px] leading-[1.45] text-ink" role="status">
            Payment cancelled. Nothing was charged, and your website is still saved.
          </p>
        ) : null}

        <Field
          label="Your website link"
          htmlFor="slug"
          error={
            remoteError && !blocked
              ? remoteError.message
              : check?.status === "invalid"
                ? "Use 3 to 40 letters, numbers and dashes, starting and ending with a letter or number."
                : check?.status === "reserved"
                  ? "That link is reserved. Choose a different one."
                  : undefined
          }
          helper={
            checking ? (
              <span className="flex items-center gap-1.5">
                <Spinner size={12} /> Checking…
              </span>
            ) : check?.status === "available" ? (
              <span className="flex items-center gap-1 font-bold text-success">
                <Icon name="check_circle" size={16} fill /> Available
              </span>
            ) : check?.status === "yours" ? (
              <span className="flex items-center gap-1 font-bold text-success">
                <Icon name="check_circle" size={16} fill /> This link is yours
              </span>
            ) : check?.status === "incomplete" ? (
              "At least 3 characters. Letters, numbers and dashes."
            ) : check?.status === "taken" ? (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-danger">
                <span className="font-semibold">Taken.</span>
                {check.suggestion ? (
                  <button
                    type="button"
                    onClick={() => setSlug(check.suggestion as string)}
                    className="font-bold text-navy underline underline-offset-2"
                  >
                    Use {check.suggestion}
                  </button>
                ) : (
                  <span>Try a different one.</span>
                )}
              </span>
            ) : (
              "Letters, numbers and dashes. You can't change it after publishing."
            )
          }
        >
          <Input
            id="slug"
            leading={`${siteHost()}/w/`}
            value={slug}
            onChange={(e) => setSlug(typedSlug(e.target.value))}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="url"
            invalid={check?.status === "invalid" || check?.status === "reserved" || check?.status === "taken"}
            maxLength={40}
          />
        </Field>

        <section className="flex flex-col gap-[14px] rounded-panel bg-navy px-5 py-[22px] text-white">
          <span className="text-label font-bold uppercase text-amber">One-time payment</span>
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[44px] font-bold leading-none tracking-[-0.03em]">{PRICE_LABEL}</span>
              <span className="text-[14px] text-white/70">once, not monthly</span>
            </div>
            <p className="text-[15px] font-semibold">One website. Lifetime access.</p>
          </div>
          <ul className="flex flex-col gap-[9px]">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-[10px] text-[14px] leading-[1.35]">
                <Icon name="check" size={18} className="mt-px shrink-0 text-amber" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-2">
          <span className="text-label font-bold uppercase text-muted">Pay with</span>
          <ul className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
            {METHODS.map((m, i) => (
              <li
                key={m.label}
                className={cn("flex items-center gap-3 px-4 py-[13px] text-[15px]", i > 0 && "border-t border-line")}
              >
                <Icon name={m.icon} size={22} className="text-navy" />
                {m.label}
              </li>
            ))}
          </ul>
          <span className="text-[12px] text-muted">You choose the method on the secure payment page.</span>
        </div>

        {needsVerification || unverifiedByServer ? (
          <EmailVerificationNotice
            variant={unverifiedByServer && !needsVerification ? "paid" : "publish"}
            onVerified={() => setUnverifiedByServer(false)}
          />
        ) : null}

        {notConfigured ? (
          <div className="flex flex-col gap-1 rounded-card border border-line bg-surface px-4 py-[14px]" role="status">
            <strong className="text-[14px]">Payments aren&apos;t switched on yet</strong>
            <p className="text-[13px] leading-[1.45] text-muted">
              {blocked
                ? remoteError?.message
                : "This deployment has no payment provider configured, so nothing can be charged or published. Your website is saved and stays free to preview and edit."}
            </p>
          </div>
        ) : null}
      </div>

      <StickyFooter>
        {payError ? (
          <p role="alert" className="rounded-input bg-danger-tint px-4 py-3 text-[13px] font-semibold text-danger">
            {payError}
          </p>
        ) : null}
        <Button
          block
          icon="lock"
          iconPosition="left"
          loading={paying}
          disabled={!usable || notConfigured || needsVerification}
          onClick={() => void pay()}
        >
          Pay {PRICE_LABEL} &amp; publish
        </Button>
        <FooterNote>Secure payment. No subscription, no renewal, ever.</FooterNote>
      </StickyFooter>
    </>
  );
}
