"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ZodError } from "zod";
import { siteContentSchema, type SiteContent } from "@/lib/site/schema";
import { updateSite } from "@/lib/site/store";

export type SaveState = "saved" | "dirty" | "saving" | "invalid" | "error";

/** Validation problems keyed by dotted path, e.g. "business.name" or "sections.2.title". */
export type Issues = Record<string, string>;

export type Update = (fn: (draft: SiteContent) => SiteContent) => void;

const DEBOUNCE_MS = 900;

const MESSAGES: Record<string, string> = {
  name: "Can't be empty",
  headline: "Can't be empty",
  title: "Can't be empty",
  label: "Can't be empty",
  email: "Enter a valid email address",
  whatsapp: "Enter a valid mobile number",
  href: "Enter a full link starting with https://",
};

function toIssues(error: ZodError): Issues {
  const issues: Issues = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".");
    const leaf = String(issue.path[issue.path.length - 1] ?? "");
    if (!issues[path]) issues[path] = MESSAGES[leaf] ?? issue.message;
  }
  return issues;
}

/**
 * Local editing state for a site's draft with debounced autosave. Edits show
 * in the preview instantly; the validated draft is written to Firestore
 * ~1s after the last change, and flushed when the screen unmounts.
 */
export function useDraft(siteId: string, initial: SiteContent) {
  const [draft, setDraft] = useState<SiteContent>(initial);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [issues, setIssues] = useState<Issues>({});
  const pending = useRef<SiteContent | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  /** Latest `save`, so a save can schedule the next one without referencing itself. */
  const saveRef = useRef<() => Promise<SaveState>>(async () => "saved");

  const save = useCallback(async (): Promise<SaveState> => {
    if (inFlight.current) return "saving";
    const next = pending.current;
    if (!next) return "saved";
    const parsed = siteContentSchema.safeParse(next);
    if (!parsed.success) {
      setIssues(toIssues(parsed.error));
      setSaveState("invalid");
      return "invalid";
    }
    setIssues({});
    pending.current = null;
    inFlight.current = true;
    setSaveState("saving");
    try {
      await updateSite(siteId, { draft: parsed.data, language: parsed.data.language });
      inFlight.current = false;
      if (pending.current) {
        setSaveState("dirty");
        timer.current = setTimeout(() => void saveRef.current(), DEBOUNCE_MS);
        return "dirty";
      }
      setSaveState("saved");
      return "saved";
    } catch (error) {
      console.error("autosave failed", error);
      inFlight.current = false;
      // Keep the newest content so a retry writes what the user sees.
      pending.current = pending.current ?? next;
      setSaveState("error");
      return "error";
    }
  }, [siteId]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), DEBOUNCE_MS);
  }, [save]);

  const update = useCallback<Update>(
    (fn) => {
      setDraft((prev) => {
        const next = fn(prev);
        pending.current = next;
        return next;
      });
      setSaveState("dirty");
      schedule();
    },
    [schedule],
  );

  /** Save now (used before navigating away and by the retry button). Resolves to the resulting state. */
  const flush = useCallback(async (): Promise<SaveState> => {
    if (timer.current) clearTimeout(timer.current);
    return save();
  }, [save]);

  // Write anything still pending when the editor unmounts.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current && !inFlight.current) void save();
    },
    [save],
  );

  // Warn before a full page unload with unsaved edits.
  useEffect(() => {
    if (saveState === "saved") return;
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [saveState]);

  return { draft, update, saveState, issues, flush };
}
