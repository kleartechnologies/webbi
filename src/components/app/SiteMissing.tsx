import { ButtonLink } from "@/components/ui";

export function SiteMissing() {
  return (
    <div className="flex flex-col gap-4 px-6 pt-10">
      <h1 className="text-[26px] leading-[1.1] tracking-[-0.03em]">We couldn&apos;t find this Webbi</h1>
      <p className="text-[14px] leading-[1.5] text-muted">
        It may belong to a different session or was deleted. Start again and it takes about two minutes.
      </p>
      <div className="flex flex-wrap gap-2 pt-2">
        <ButtonLink href="/start" size="md">
          Start again
        </ButtonLink>
        <ButtonLink href="/dashboard" variant="secondary" size="md">
          Dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
