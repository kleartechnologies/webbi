import type { RenderCtx } from "./context";
import { SocialLinks } from "./SocialLinks";

export function SiteFooter({ ctx }: { ctx: RenderCtx }) {
  const { site, strings, target, rel } = ctx;
  return (
    <footer className="mx-auto w-full max-w-[1120px] px-4 pt-8 pb-10 text-center text-[12px] leading-[1.5] text-site-muted">
      {/* Social icons land here only when the site has no contact (or, person-led, about) section. */}
      <SocialLinks ctx={ctx} at="footer" className="justify-center pb-4" />
      © {site.business.name} {new Date().getFullYear()}
      {site.theme.showCredit === false ? null : (
        <>
          {" "}· {strings.builtWith}{" "}
          {/* A full page load, not a client-side navigation: Webbi's app has its own security policy (src/lib/security/headers.ts). */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- deliberate: next/link would keep the site's stricter CSP on the app */}
          <a href="/" target={target} rel={rel} className="font-bold text-site-ink">
            Webbi
          </a>
        </>
      )}
    </footer>
  );
}
