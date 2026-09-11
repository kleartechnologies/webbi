import { ButtonLink, Container, Wordmark } from "@/components/ui";

// Phase 1 placeholder. Replaced by the full landing page in Phase 2.
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <Container className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
        <Wordmark size={28} />
        <h1 className="max-w-[18ch] text-h1 sm:text-display">Tell us what you do. We&apos;ll build your website.</h1>
        <p className="max-w-[44ch] text-body text-muted">
          Professional websites for Malaysian businesses, creators and salespeople. See it free, pay RM149.90 to go live.
        </p>
        <ButtonLink href="/start" icon="arrow_forward">
          Create My Website
        </ButtonLink>
      </Container>
    </main>
  );
}
