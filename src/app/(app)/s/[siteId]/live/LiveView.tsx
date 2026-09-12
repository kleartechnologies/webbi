"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toDataURL } from "qrcode";
import { AppPage } from "@/components/app/AppHeader";
import { CenteredWordmark, StickyFooter } from "@/components/app/FlowChrome";
import { RequireAuth } from "@/components/app/RequireAuth";
import { SiteMissing } from "@/components/app/SiteMissing";
import { ButtonLink, Icon, Spinner, type IconName } from "@/components/ui";
import { cn } from "@/lib/cn";
import { publicSitePath, publicSiteUrl, resumePath, siteHost, siteName } from "@/lib/site/flow";
import type { Site } from "@/lib/site/types";
import { useSite } from "@/lib/site/useSite";

/** Step 09 in the design: "You're live." with link, QR and share tiles. */
export function LiveView({ siteId }: { siteId: string }) {
  const site = useSite(siteId);
  return (
    <RequireAuth allow={["account"]}>
      <AppPage>
        {site === undefined ? (
          <div className="flex flex-1 items-center justify-center py-24 text-navy">
            <Spinner size={28} />
          </div>
        ) : site === null ? (
          <SiteMissing />
        ) : (
          <Live site={site} />
        )}
      </AppPage>
    </RequireAuth>
  );
}

function Live({ site }: { site: Site }) {
  const router = useRouter();
  const live = site.status === "published" && site.slug;
  const [copied, setCopied] = useState(false);
  const [instagramHint, setInstagramHint] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!live) router.replace(resumePath(site));
  }, [live, site, router]);

  const slug = site.slug ?? "";
  const url = publicSiteUrl(slug);
  const name = siteName(site);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    toDataURL(url, { width: 480, margin: 1, color: { dark: "#151A2D", light: "#FFFFFF" } })
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url, live]);

  if (!live) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-navy">
        <Spinner size={28} />
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const shareText = `${name} · ${url}`;
  const more = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    await copy();
  };
  const instagram = async () => {
    await copy();
    setInstagramHint(true);
  };

  return (
    <>
      <CenteredWordmark />
      <div className="flex flex-1 flex-col gap-[22px] px-5 pt-3">
        <div className="flex flex-col items-start gap-[14px]">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-tint text-success">
            <Icon name="check_circle" size={32} fill />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="text-[32px] leading-[1.05] tracking-[-0.03em]">You&apos;re live.</h1>
            <p className="text-[15px] leading-[1.5] text-muted">
              <span className="font-bold text-ink">{name}</span> is now on the internet. Share it everywhere your
              customers are.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-pill border-[1.5px] border-navy bg-surface py-[6px] pl-[18px] pr-[6px]">
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
            {siteHost()}
            {publicSitePath(slug)}
          </span>
          <button
            type="button"
            onClick={() => void copy()}
            className="flex h-9 shrink-0 items-center gap-1 rounded-pill bg-navy px-[14px] text-[13px] font-bold text-white"
          >
            <Icon name={copied ? "check" : "content_copy"} size={16} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <section className="flex items-center gap-4 rounded-panel border border-line bg-surface p-4">
          <span className="flex h-[120px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-card border border-line bg-white">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={`QR code for ${url}`} width={120} height={120} className="h-full w-full" />
            ) : (
              <Spinner size={20} className="text-navy" />
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <strong className="text-[16px]">Your QR code</strong>
            <p className="text-[13px] leading-[1.45] text-muted">
              Print it for your counter, packaging or flyers. Scans open your website.
            </p>
            <a
              href={qr ?? "#"}
              download={`${slug}-qr.png`}
              aria-disabled={!qr}
              className={cn(
                "inline-flex h-10 w-fit items-center gap-1.5 rounded-pill border-[1.5px] border-line-input px-4 text-[13px] font-bold text-ink",
                !qr && "pointer-events-none opacity-50",
              )}
            >
              <Icon name="download" size={18} />
              Download
            </a>
          </div>
        </section>

        <div className="flex flex-col gap-[10px]">
          <span className="text-label font-bold uppercase text-muted">Share to</span>
          <div className="grid grid-cols-4 gap-2">
            <ShareTile
              icon="chat"
              label="WhatsApp"
              className="bg-[#25D366] text-white"
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            />
            <ShareTile icon="photo_camera" label="Instagram" className="bg-ink text-white" onClick={instagram} />
            <ShareTile
              icon="thumb_up"
              label="Facebook"
              className="bg-navy text-white"
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
            />
            <ShareTile icon="ios_share" label="More" className="bg-ground text-ink" onClick={more} />
          </div>
          {instagramHint ? (
            <p className="text-[12px] leading-[1.4] text-muted" role="status">
              Link copied. Paste it into your Instagram bio or a story sticker.
            </p>
          ) : null}
        </div>
      </div>

      <StickyFooter>
        <a
          href={publicSitePath(slug)}
          target="_blank"
          rel="noopener"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-pill bg-navy text-[16px] font-bold text-white"
        >
          <Icon name="open_in_new" size={20} />
          View my website
        </a>
        <ButtonLink href="/dashboard" variant="ghost" block>
          Go to My Webbi
        </ButtonLink>
      </StickyFooter>
    </>
  );
}

function ShareTile({
  icon,
  label,
  className,
  href,
  onClick,
}: {
  icon: IconName;
  label: string;
  className: string;
  href?: string;
  onClick?: () => void;
}) {
  const classes = cn(
    "flex flex-col items-center justify-center gap-1.5 rounded-card py-3 text-[11px] font-bold",
    className,
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener" className={classes}>
        <Icon name={icon} size={24} />
        {label}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      <Icon name={icon} size={24} />
      {label}
    </button>
  );
}
