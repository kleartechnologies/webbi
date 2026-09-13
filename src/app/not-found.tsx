import { ButtonLink, Container, Wordmark } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col">
      <Container className="flex flex-1 flex-col items-center justify-center gap-5 py-16 text-center">
        <Wordmark />
        <h1 className="text-h1">Page not found</h1>
        <p className="max-w-[40ch] text-body text-muted">That link doesn&apos;t go anywhere. It may have been removed or typed wrongly.</p>
        {/* Full load: this page can be a missing customer site under /w/, which has a stricter security policy than the app. */}
        <ButtonLink href="/" variant="secondary" fullLoad>
          Back to Webbi
        </ButtonLink>
      </Container>
    </main>
  );
}
