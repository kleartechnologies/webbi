"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AppPage } from "@/components/app/AppHeader";
import { CenteredWordmark } from "@/components/app/FlowChrome";
import { RequireAuth } from "@/components/app/RequireAuth";
import { Button, ButtonLink, Icon, Spinner } from "@/components/ui";
import { EmailVerificationNotice } from "@/components/app/EmailVerificationNotice";
import { ApiError, callApi, errorMessage } from "@/lib/api/client";
import { useSite } from "@/lib/site/useSite";

type ConfirmResponse =
  | { status: "published"; slug: string }
  | { status: "pending" }
  | { status: "failed"; reason: string };

type State =
  | { kind: "confirming" }
  | { kind: "slow" }
  | { kind: "paid" }
  | { kind: "failed" }
  /** Paid, but the account's email isn't verified yet: the payment is kept and publishes after verification. */
  | { kind: "unverified" }
  | { kind: "error"; message: string };

const POLL_MS = 3000;
const MAX_POLLS = 20;
/** Long enough to read "Payment successful" before the Live screen replaces it. */
const SUCCESS_MS = 1600;

/**
 * Where the payment provider sends the customer back. Nothing in the URL is
 * believed: the server checks the redirect's signature, asks the provider
 * whether the checkout was paid, and publishes on that answer only. Until then
 * this page just says it is confirming, and the live subscription to the site
 * moves on the moment the provider's callback publishes it.
 */
export function ReturnView({ siteId }: { siteId: string }) {
  return (
    <RequireAuth allow={["account"]}>
      <AppPage>
        <CenteredWordmark />
        <Suspense fallback={null}>
          <Confirm siteId={siteId} />
        </Suspense>
      </AppPage>
    </RequireAuth>
  );
}

function Confirm({ siteId }: { siteId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  // Stripe and the dev mock send session_id; Billplz sends its signed billplz[…] parameters.
  const sessionId = params.get("session_id") ?? params.get("billplz[id]");
  // Only the provider's own parameters: Billplz signs exactly these, and anything else on the URL is noise.
  const redirectQuery = new URLSearchParams([...params].filter(([key]) => key.startsWith("billplz["))).toString();
  const site = useSite(siteId);
  const [state, setState] = useState<State>({ kind: "confirming" });
  const [attempt, setAttempt] = useState(0);
  const done = useRef(false);
  // Published by the callback (or a moment ago by this page): only the server can make this true.
  const published = site?.status === "published";
  const shown: State = published ? { kind: "paid" } : state;

  useEffect(() => {
    if (shown.kind !== "paid") return;
    const timer = setTimeout(() => router.replace(`/s/${siteId}/live`), SUCCESS_MS);
    return () => clearTimeout(timer);
  }, [shown.kind, siteId, router]);

  useEffect(() => {
    if (!sessionId || published || done.current) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const result = await callApi<ConfirmResponse>("/api/publish/confirm", { siteId, sessionId, redirectQuery });
        if (cancelled || done.current) return;
        if (result.status === "published") {
          done.current = true;
          setState({ kind: "paid" });
        } else if (result.status === "pending") {
          if (attempt + 1 >= MAX_POLLS) setState({ kind: "slow" });
          else timer = setTimeout(() => setAttempt((n) => n + 1), POLL_MS);
        } else {
          setState({ kind: "failed" });
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.code === "email_unverified") setState({ kind: "unverified" });
        else setState({ kind: "error", message: errorMessage(error) });
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, redirectQuery, siteId, attempt, published]);

  if (!sessionId && shown.kind !== "paid") {
    return (
      <Message title="Nothing to confirm" body="This page is only used on the way back from payment.">
        <ButtonLink href={`/s/${siteId}/publish`} block>
          Back to publish
        </ButtonLink>
      </Message>
    );
  }

  if (shown.kind === "paid") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center" role="status">
        <Icon name="check_circle" size={40} fill className="text-success" />
        <h1 className="text-[24px] leading-[1.15] tracking-[-0.02em]">Payment successful</h1>
        <p className="max-w-[320px] text-[14px] leading-[1.5] text-muted">Your website is being published.</p>
      </div>
    );
  }

  if (shown.kind === "confirming") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center" role="status">
        <Spinner size={32} className="text-navy" />
        <h1 className="text-[24px] leading-[1.15] tracking-[-0.02em]">We&apos;re confirming your payment.</h1>
        <p className="max-w-[320px] text-[14px] leading-[1.5] text-muted">Your website will be available shortly.</p>
      </div>
    );
  }

  if (shown.kind === "slow") {
    return (
      <Message
        title="We're confirming your payment."
        body="Your website will be available shortly. It goes live on its own once your bank confirms, so you can close this page."
      >
        <Button block onClick={() => { setState({ kind: "confirming" }); setAttempt(0); }}>
          Check again
        </Button>
        <ButtonLink href="/dashboard" variant="ghost" block>
          Go to My Webbi
        </ButtonLink>
      </Message>
    );
  }

  if (shown.kind === "unverified") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-24 text-center">
        <h1 className="text-[24px] leading-[1.15] tracking-[-0.02em]">Payment received</h1>
        <div className="w-full max-w-[360px] text-left">
          <EmailVerificationNotice variant="paid" onVerified={() => router.replace(`/s/${siteId}/publish`)} />
        </div>
        <div className="flex w-full max-w-[320px] flex-col gap-2">
          <ButtonLink href={`/s/${siteId}/publish`} block>
            Back to publish
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (shown.kind === "failed") {
    return (
      <Message title="Payment wasn't completed." body="Your website hasn't been published.">
        <ButtonLink href={`/s/${siteId}/publish`} block>
          Try again
        </ButtonLink>
      </Message>
    );
  }

  return (
    <Message title="We couldn't confirm the payment" body={shown.message}>
      <ButtonLink href={`/s/${siteId}/publish`} block>
        Back to publish
      </ButtonLink>
      <Button variant="ghost" block onClick={() => { setState({ kind: "confirming" }); setAttempt((n) => n + 1); }}>
        Check again
      </Button>
    </Message>
  );
}

function Message({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-24 text-center">
      <h1 className="text-[24px] leading-[1.15] tracking-[-0.02em]">{title}</h1>
      <p className="max-w-[320px] text-[14px] leading-[1.5] text-muted">{body}</p>
      <div className="flex w-full max-w-[320px] flex-col gap-2">{children}</div>
    </div>
  );
}
