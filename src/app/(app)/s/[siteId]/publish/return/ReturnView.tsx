"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppPage } from "@/components/app/AppHeader";
import { CenteredWordmark } from "@/components/app/FlowChrome";
import { RequireAuth } from "@/components/app/RequireAuth";
import { Button, ButtonLink, Spinner } from "@/components/ui";
import { callApi, errorMessage } from "@/lib/api/client";
import { useSite } from "@/lib/site/useSite";

type ConfirmResponse =
  | { status: "published"; slug: string }
  | { status: "pending" }
  | { status: "failed"; reason: string };

type State =
  | { kind: "confirming" }
  | { kind: "failed"; message: string }
  | { kind: "error"; message: string };

const POLL_MS = 3000;
const MAX_POLLS = 20;

/**
 * Where the payment provider sends the customer back. The session id in the
 * URL is only a lookup key: the server asks the provider whether it was paid
 * and publishes on its answer, never on ours.
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
  const sessionId = params.get("session_id");
  const site = useSite(siteId);
  const [state, setState] = useState<State>({ kind: "confirming" });
  const [attempt, setAttempt] = useState(0);

  // The webhook may have published already; the live subscription sees it first.
  useEffect(() => {
    if (site?.status === "published") router.replace(`/s/${siteId}/live`);
  }, [site?.status, siteId, router]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const result = await callApi<ConfirmResponse>("/api/publish/confirm", { siteId, sessionId });
        if (cancelled) return;
        if (result.status === "published") {
          router.replace(`/s/${siteId}/live`);
        } else if (result.status === "pending") {
          if (attempt + 1 >= MAX_POLLS) {
            setState({
              kind: "error",
              message: "Your bank hasn't confirmed the payment yet. Check My Webbi in a few minutes; it goes live automatically once confirmed.",
            });
          } else {
            timer = setTimeout(() => setAttempt((n) => n + 1), POLL_MS);
          }
        } else {
          setState({ kind: "failed", message: "The payment didn't go through. Nothing was charged." });
        }
      } catch (error) {
        if (!cancelled) setState({ kind: "error", message: errorMessage(error) });
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, siteId, attempt, router]);

  if (!sessionId) {
    return (
      <Message title="Nothing to confirm" body="This page is only used on the way back from payment.">
        <ButtonLink href={`/s/${siteId}/publish`} block>
          Back to publish
        </ButtonLink>
      </Message>
    );
  }

  if (state.kind === "confirming") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <Spinner size={32} className="text-navy" />
        <h1 className="text-[24px] leading-[1.15] tracking-[-0.02em]">Confirming your payment…</h1>
        <p className="max-w-[320px] text-[14px] leading-[1.5] text-muted">
          Checking with the payment provider. This usually takes a few seconds.
        </p>
      </div>
    );
  }

  return (
    <Message title={state.kind === "failed" ? "Payment not completed" : "We couldn't confirm the payment"} body={state.message}>
      <ButtonLink href={`/s/${siteId}/publish`} block>
        {state.kind === "failed" ? "Try again" : "Back to publish"}
      </ButtonLink>
      {state.kind === "error" ? (
        <Button variant="ghost" block onClick={() => { setState({ kind: "confirming" }); setAttempt((n) => n + 1); }}>
          Check again
        </Button>
      ) : null}
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
