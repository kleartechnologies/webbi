import Link from "next/link";
import type { RenderCtx } from "./context";

export function SiteFooter({ ctx }: { ctx: RenderCtx }) {
  const { site, strings, target, rel } = ctx;
  return (
    <footer className="mx-auto w-full max-w-[1120px] px-4 pt-8 pb-10 text-center text-[12px] leading-[1.5] text-site-muted">
      © {site.business.name} {new Date().getFullYear()}
      {site.theme.showCredit === false ? null : (
        <>
          {" "}· {strings.builtWith}{" "}
          <Link href="/" target={target} rel={rel} prefetch={false} className="font-bold text-site-ink">
            Webbi
          </Link>
        </>
      )}
    </footer>
  );
}
