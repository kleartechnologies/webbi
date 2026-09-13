"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppPage } from "@/components/app/AppHeader";
import { CenteredWordmark, FooterNote, StickyFooter } from "@/components/app/FlowChrome";
import { RequireAuth } from "@/components/app/RequireAuth";
import { Button, ErrorText, Icon, Textarea } from "@/components/ui";
import { callApi, errorMessage } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { Understanding } from "@/lib/site/schema";
import { createSite } from "@/lib/site/store";

const EXAMPLES = [
  "Saya buka kedai makan di Kajang, jual nasi lemak dan lauk kampung. Customer biasa order ikut WhatsApp.",
  "I'm a Proton sales advisor in Shah Alam. Test drives, trade-ins and loan help.",
  "Saya buat servis dan pasang aircond area Cheras, harga bermula RM80.",
];

/**
 * Step 01: the description. Building is account-first — a visitor who presses
 * "Create My Website" signs up here first and comes straight back, so every
 * draft has an owner from its first keystroke.
 */
export function StartView() {
  return (
    <RequireAuth authMode="create">
      <Start />
    </RequireAuth>
  );
}

function Start() {
  const router = useRouter();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = !text.trim();

  const submit = async () => {
    const description = text.trim();
    if (!user) return;
    if (description.length < 12) {
      setError("Tell us a bit more. One or two sentences is enough.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { understanding } = await callApi<{ understanding: Understanding }>("/api/ai/understand", { description });
      const siteId = await createSite({
        ownerUid: user.uid,
        sourceDescription: description,
        language: understanding.language,
        generation: { status: "understood", understanding },
      });
      router.push(`/s/${siteId}/confirm`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <AppPage>
      <CenteredWordmark />
      <div className="flex flex-col gap-[18px] px-6 pt-7">
        <div className="flex flex-col gap-2">
          <h1 className="text-[36px] leading-[1.05] tracking-[-0.03em]">What do you do?</h1>
          <p className="text-[15px] leading-[1.5] text-muted [text-wrap:pretty]">
            Tell us about your business the way you&apos;d tell a friend. BM or English, both fine.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Textarea
            large
            className="resize-none"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Saya buka kedai makan di Kajang, jual nasi lemak dan lauk kampung…"
            aria-label="Describe your business"
            maxLength={4000}
            disabled={busy}
            autoFocus
          />
          {error ? <ErrorText>{error}</ErrorText> : null}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">Try an example</span>
          <div className="flex flex-col gap-[6px]">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                disabled={busy}
                onClick={() => {
                  setText(example);
                  setError(null);
                }}
                className="flex items-center gap-[10px] rounded-input border border-line bg-surface px-[14px] py-[10px] text-left text-[14px] leading-[1.35] text-ink transition-colors hover:border-navy"
              >
                <Icon name="auto_awesome" size={18} fill className="text-amber" />
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
      <StickyFooter>
        <Button
          block
          icon="arrow_forward"
          loading={busy}
          onClick={submit}
          aria-disabled={empty || undefined}
          className={empty ? "opacity-45" : undefined}
        >
          {busy ? "Reading your description…" : "Continue"}
        </Button>
        <FooterNote>
          About 2 minutes. No design skills needed.{" "}
          <Link href="/dashboard" className="font-semibold text-navy">
            Dashboard
          </Link>
        </FooterNote>
      </StickyFooter>
    </AppPage>
  );
}
