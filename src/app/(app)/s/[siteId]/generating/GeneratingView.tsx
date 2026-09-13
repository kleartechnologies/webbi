"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppPage } from "@/components/app/AppHeader";
import { CenteredWordmark } from "@/components/app/FlowChrome";
import { RequireAuth } from "@/components/app/RequireAuth";
import { SiteMissing } from "@/components/app/SiteMissing";
import { Button, ButtonLink, Icon, Spinner } from "@/components/ui";
import { ApiError, callApi, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { SiteContent } from "@/lib/site/schema";
import { updateSite } from "@/lib/site/store";
import type { Site } from "@/lib/site/types";
import { useSite } from "@/lib/site/useSite";

const STEPS = [
  "Understanding your business…",
  "Organizing your content…",
  "Choosing the right layout…",
  "Creating your website…",
  "Optimizing for mobile…",
];
/** Steps 0–3 tick on a timer while the AI works; step 4 completes when the draft lands. */
const STEP_MS = 2400;

export function GeneratingView({ siteId }: { siteId: string }) {
  const site = useSite(siteId);
  return (
    <RequireAuth allow={["anonymous", "account"]}>
      <AppPage>
        {site === undefined ? (
          <div className="flex flex-1 items-center justify-center py-24 text-navy">
            <Spinner size={28} />
          </div>
        ) : site === null ? (
          <SiteMissing />
        ) : (
          <Generating site={site} />
        )}
      </AppPage>
    </RequireAuth>
  );
}

function Generating({ site }: { site: Site }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(site.generation?.status === "error" ? (site.generation.error ?? null) : null);
  const [attempt, setAttempt] = useState(0);
  const running = useRef<string | null>(null);
  // Set when the browser is leaving the page (refresh, back, close). The
  // browser then cancels the in-flight request, which must not be recorded as
  // a generation error: the next mount simply runs the generation again.
  const leaving = useRef(false);
  const status = site.generation?.status;

  useEffect(() => {
    const onLeave = () => {
      leaving.current = true;
    };
    window.addEventListener("beforeunload", onLeave);
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      window.removeEventListener("pagehide", onLeave);
    };
  }, []);
  const hasDraft = Boolean(site.draft);

  // Already built (e.g. refresh after completion) → straight to the reveal.
  useEffect(() => {
    if (status === "ready" && hasDraft) router.replace(`/s/${site.id}/ready`);
    else if (status === "understood" || status === "understanding") router.replace(`/s/${site.id}/content`);
  }, [status, hasDraft, site.id, router]);

  // Step ticker while waiting.
  useEffect(() => {
    if (error) return;
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, 3)), STEP_MS);
    return () => clearInterval(timer);
  }, [error, attempt]);

  // Run the generation exactly once per site (and once per retry). The ref guard
  // survives StrictMode's double effect run; the request is never cancelled so a
  // remount can't lose a finished draft.
  useEffect(() => {
    const generation = site.generation;
    const input = generation?.input;
    if (status !== "generating" || !generation || !input) return;
    const key = `${site.id}:${attempt}`;
    if (running.current === key) return;
    running.current = key;
    (async () => {
      try {
        // The server builds the request from this site and saves the draft itself.
        await callApi<{ site: SiteContent; model: string }>("/api/ai/generate", { siteId: site.id });
        // The snapshot effect above redirects once the doc reads status "ready";
        // a separate timer here could fire after the user has already moved on.
        setStep(5);
      } catch (err) {
        if (leaving.current) return;
        const message = errorMessage(err);
        setError(message);
        // 409: an earlier visit (or another tab) is still building this site and
        // saves its own result, so the site must not be marked as failed.
        if (err instanceof ApiError && err.status === 409) return;
        await updateSite(site.id, { generation: { ...generation, status: "error", error: message } }).catch(() => {});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kick off once per site/attempt; site fields are read at kick-off only
  }, [status, site.id, attempt]);

  const retry = async () => {
    setError(null);
    setStep(0);
    await updateSite(site.id, { generation: { ...site.generation, status: "generating", error: undefined } });
    setAttempt((a) => a + 1);
  };

  const title = error ? "Something went wrong" : step >= 5 ? "Your Webbi is ready." : STEPS[Math.min(step, 4)];
  const sk = { a: step >= 1, b: step >= 3, c: step >= 4, d: step >= 4, e: step >= 2 };
  const pct = Math.min(100, Math.round((step / 5) * 100));

  return (
    <>
      <CenteredWordmark />
      <div className="flex flex-1 flex-col items-center gap-7 px-6 pt-6">
        <h1 className="min-h-[62px] text-center text-[28px] leading-[1.1] tracking-[-0.03em]" aria-live="polite">
          {title}
        </h1>

        {error ? (
          <div className="flex w-full flex-col gap-4">
            <p className="rounded-input bg-danger-tint p-4 text-[14px] font-semibold leading-[1.45] text-danger">{error}</p>
            <Button block icon="refresh" onClick={retry}>
              Try again
            </Button>
            <ButtonLink block variant="secondary" href={`/s/${site.id}/content`}>
              Back to your content
            </ButtonLink>
          </div>
        ) : (
          <>
            <div
              className="relative flex h-[372px] w-[212px] flex-col gap-[10px] overflow-hidden rounded-[30px] border border-line bg-surface px-[14px] py-4 shadow-floating"
              aria-hidden
            >
              <div className={cn("flex items-center justify-between transition-opacity duration-500", sk.a ? "opacity-100" : "opacity-[.12]")}>
                <span className="h-[10px] w-[70px] rounded-[5px] bg-[#B4472B]" />
                <span className="h-[10px] w-[18px] rounded-[5px] bg-line" />
              </div>
              <div
                className={cn("h-[118px] rounded-card transition-opacity duration-500", sk.b ? "opacity-100" : "opacity-[.12]")}
                style={{ background: "repeating-linear-gradient(135deg,#D9B99B 0 8px,#CFAE8E 8px 16px)" }}
              />
              <div className={cn("h-[30px] rounded-pill bg-whatsapp transition-opacity duration-500", sk.c ? "opacity-100" : "opacity-[.12]")} />
              <div className={cn("grid grid-cols-4 gap-[6px] transition-opacity duration-500", sk.d ? "opacity-100" : "opacity-[.12]")}>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="h-[26px] rounded-[8px] bg-[#F3E9DC]" />
                ))}
              </div>
              <div className={cn("grid grid-cols-2 gap-2 transition-opacity duration-500", sk.e ? "opacity-100" : "opacity-[.12]")}>
                {[70, 60].map((w) => (
                  <div key={w} className="flex flex-col gap-[5px]">
                    <span className="h-14 rounded-[10px]" style={{ background: "repeating-linear-gradient(135deg,#D9B99B 0 8px,#CFAE8E 8px 16px)" }} />
                    <span className="h-2 rounded-[4px] bg-line" style={{ width: `${w}%` }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex w-full flex-col gap-[14px]">
              <div className="h-1 overflow-hidden rounded-[2px] bg-line">
                <div className="h-full rounded-[2px] bg-navy transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
              </div>
              <ol className="flex flex-col gap-[9px]">
                {STEPS.map((label, i) => {
                  const done = i < step;
                  const active = i === step;
                  return (
                    <li
                      key={label}
                      className={cn(
                        "flex items-center gap-[10px] text-[14px] transition-colors",
                        done || active ? "text-ink" : "text-placeholder",
                        active ? "font-bold" : "font-medium",
                      )}
                    >
                      {done ? (
                        <Icon name="check_circle" size={20} fill className="text-success" />
                      ) : active ? (
                        <Icon name="progress_activity" size={20} className="animate-spin text-amber" />
                      ) : (
                        <span className="mx-[3px] h-[14px] w-[14px] flex-none rounded-full border-2 border-line-input" />
                      )}
                      {label}
                    </li>
                  );
                })}
              </ol>
            </div>
          </>
        )}
      </div>
      <p className="px-5 pt-4 pb-safe text-center text-[12px] text-muted">Sabar sekejap, this takes under a minute.</p>
    </>
  );
}
