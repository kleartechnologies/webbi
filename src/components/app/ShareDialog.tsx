"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button, Icon, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  buildQrDownload,
  copyLink,
  qrAlt,
  qrSvg,
  saveFile,
  shareLink,
  type QrFormat,
  type ShareTarget,
} from "@/lib/site/share";

type Notice = { tone: "ok" | "error"; text: string } | null;

const loadQr = () => import("qrcode");

/** "Share your website": QR code, PNG / SVG downloads, the link with Copy, and native Share. */
export function ShareDialog({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const urlInput = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleId = useId();
  const captionId = useId();
  const urlId = useId();
  const [svg, setSvg] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  const [saving, setSaving] = useState<QrFormat | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = overflow;
      clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    let live = true;
    loadQr()
      .then((lib) => qrSvg(lib, target.url))
      .then((markup) => {
        if (live) setSvg(markup);
      })
      .catch(() => {
        if (live) setQrFailed(true);
      });
    return () => {
      live = false;
    };
  }, [target.url]);

  const announce = (next: Notice) => {
    clearTimeout(timer.current);
    setNotice(next);
    if (next?.tone === "ok") {
      timer.current = setTimeout(() => {
        setNotice(null);
        setCopied(false);
      }, 2200);
    }
  };

  const linkCopied = () => {
    setCopied(true);
    announce({ tone: "ok", text: "Link copied" });
  };

  const copyFailed = () => {
    setCopied(false);
    urlInput.current?.focus();
    urlInput.current?.select();
    announce({ tone: "error", text: "Couldn't copy automatically. The link is selected so you can copy it yourself." });
  };

  const copy = async () => {
    const result = await copyLink(target.url, navigator.clipboard);
    if (result === "copied") linkCopied();
    else copyFailed();
  };

  const share = async () => {
    const result = await shareLink(target, navigator);
    if (result === "copied") linkCopied();
    else if (result === "failed") copyFailed();
  };

  const download = async (format: QrFormat) => {
    setSaving(format);
    try {
      const { fileName, blob } = await buildQrDownload(await loadQr(), target, format);
      saveFile(blob, fileName);
      announce({ tone: "ok", text: `Downloaded ${fileName}` });
    } catch {
      announce({ tone: "error", text: "Couldn't create the download. Please try again." });
    } finally {
      setSaving(null);
    }
  };

  const close = () => dialog.current?.close();

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // A click on the dimmed backdrop lands on the <dialog> itself.
        if (e.target === e.currentTarget) close();
      }}
      className="m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[400px] overflow-y-auto rounded-panel border border-line bg-surface p-0 text-ink shadow-floating backdrop:bg-ink/50"
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-[20px] leading-tight tracking-[-0.02em]">
            Share your website
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-mr-2 flex h-11 w-11 flex-none items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink"
          >
            <Icon name="close" size={24} />
          </button>
        </div>

        <figure className="flex flex-col items-center gap-3">
          <div className="flex aspect-square w-full max-w-[240px] items-center justify-center rounded-card border border-line bg-white">
            {svg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
                alt={qrAlt(target)}
                aria-describedby={captionId}
                width={238}
                height={238}
                className="h-full w-full rounded-card"
              />
            ) : qrFailed ? (
              <p role="alert" className="px-6 text-center text-[13px] font-semibold text-danger">
                Couldn&apos;t make the QR code. Close this and try again.
              </p>
            ) : (
              <Spinner size={26} className="text-navy" />
            )}
          </div>
          <figcaption id={captionId} className="text-[14px] font-semibold text-muted">
            Scan to visit your website
          </figcaption>
        </figure>

        <div className="grid grid-cols-2 gap-2">
          {(["png", "svg"] as const).map((format) => (
            <button
              key={format}
              type="button"
              disabled={!svg || saving !== null}
              aria-busy={saving === format || undefined}
              onClick={() => void download(format)}
              className="flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-pill border-[1.5px] border-line-input bg-surface px-2 text-[13px] font-bold text-ink hover:border-navy disabled:opacity-45"
            >
              {saving === format ? <Spinner size={18} /> : <Icon name="download" size={18} className="text-navy" />}
              Download {format.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={urlId} className="text-[13px] font-bold text-ink">
            Website link
          </label>
          <div className="flex items-center gap-2 rounded-input border-[1.5px] border-line-input bg-surface py-1.5 pl-3.5 pr-1.5 focus-within:border-navy">
            <input
              ref={urlInput}
              id={urlId}
              type="url"
              readOnly
              value={target.url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 truncate bg-transparent text-[14px] font-semibold text-ink focus-visible:outline-none"
            />
            <Button
              size="md"
              icon={copied ? "check" : "content_copy"}
              iconPosition="left"
              onClick={() => void copy()}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <Button block size="md" variant="secondary" icon="ios_share" iconPosition="left" onClick={() => void share()}>
          Share
        </Button>

        <p
          role="status"
          aria-live="polite"
          className={cn(
            "-mt-2 min-h-[20px] text-center text-[13px] font-semibold",
            notice?.tone === "error" ? "text-danger" : "text-success",
          )}
        >
          {notice?.text}
        </p>
      </div>
    </dialog>
  );
}
