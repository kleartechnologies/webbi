"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { LANDING_TITLE } from "@/lib/seo";
import { LANDING_COPY, type LandingCopy, type LandingLang } from "./copy";

/**
 * The landing's language: English unless the visitor picked Bahasa Melayu
 * before. The choice lives in this browser only (localStorage), never on the
 * server, and follows the visitor across tabs.
 */
const KEY = "webbi.landing.lang";
const listeners = new Set<() => void>();
/** Used when storage is blocked (private mode, disabled cookies). */
let memory: LandingLang = "en";

function read(): LandingLang {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "en" || stored === "ms") return stored;
  } catch {}
  return memory;
}

function write(lang: LandingLang) {
  memory = lang;
  try {
    window.localStorage.setItem(KEY, lang);
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

interface Value {
  lang: LandingLang;
  copy: LandingCopy;
  setLang: (lang: LandingLang) => void;
}

/** Outside the landing (the legal pages share its nav and footer) copy stays English. */
const Context = createContext<Value>({ lang: "en", copy: LANDING_COPY.en, setLang: () => {} });

export function LandingLanguage({ children }: { children: ReactNode }) {
  // The server and the first client render are English; a stored choice applies right after hydration.
  const lang = useSyncExternalStore(subscribe, read, () => "en" as const);
  const value = useMemo(() => ({ lang, copy: LANDING_COPY[lang], setLang: write }), [lang]);

  useEffect(() => {
    const root = document.documentElement;
    const previousLang = root.lang;
    const previousTitle = document.title;
    // English is the server-rendered SEO title, so only BM visibly changes the tab.
    const title = LANDING_TITLE[lang];
    root.lang = lang;
    document.title = title;
    return () => {
      root.lang = previousLang;
      // Leave the title alone if navigation already replaced it.
      if (document.title === title) document.title = previousTitle;
    };
  }, [lang]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLandingLanguage(): Value {
  return useContext(Context);
}

export function useLandingCopy(): LandingCopy {
  return useContext(Context).copy;
}
