import { ButtonLink, Wordmark } from "@/components/ui";

export default function SiteNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <Wordmark />
      <h1 className="text-h1">This Webbi isn&apos;t live yet</h1>
      <p className="max-w-[40ch] text-body text-muted">
        There&apos;s no published website at this address. If it&apos;s yours, finish publishing from your dashboard.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <ButtonLink href="/start" size="md">
          Build your own Webbi
        </ButtonLink>
        <ButtonLink href="/dashboard" variant="secondary" size="md">
          Dashboard
        </ButtonLink>
      </div>
    </main>
  );
}
