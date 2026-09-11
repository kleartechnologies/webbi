import { ButtonLink, Wordmark } from "@/components/ui";
import { NavAuthLink } from "./NavAuthLink";

export function LandingNav() {
  return (
    <nav className="sticky top-0 z-10 border-b border-line bg-ground/90 backdrop-blur-[10px]">
      <div className="mx-auto flex w-full max-w-webbi items-center justify-between gap-4 px-5 py-3 sm:px-6">
        <Wordmark href="#top" size={26} />
        <div className="flex items-center gap-1.5">
          <NavAuthLink />
          <ButtonLink href="/start" size="md" className="h-[42px] px-[18px] text-[14px]">
            Create My Website
          </ButtonLink>
        </div>
      </div>
    </nav>
  );
}
