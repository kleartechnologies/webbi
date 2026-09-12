# Webbi

AI website generator for Malaysian small businesses. Describe your business in one sentence (BM or English), preview the finished website free, pay RM149.90 once to publish it at `webbi.my/w/your-business`.

One shared Next.js app renders every customer site from structured data. No per-customer HTML is generated.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- Firebase (project `webbi-85f26`): Auth, Firestore, Storage, security rules in `firestore.rules` / `storage.rules`
- Anthropic Claude (server-side only) turns the description into validated structured site data
- Netlify for hosting (`netlify.toml`), payments through an isolated provider boundary

## Local development

```bash
cp .env.example .env.local   # then fill in the values below
npm install
npm run dev                  # http://localhost:3000
```

Checks: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` (see "Tests and QA").

### Local dev without real credentials (Firebase emulators)

The whole flow — sign-in, generation, editing, payment and publishing — can be exercised locally with the Firebase Emulator Suite, the mock AI provider and the mock payment provider. Nothing touches the real project.

```bash
# once: Java 21 for the emulators
brew install openjdk@21
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"

# terminal 1
npx firebase emulators:start --only auth,firestore,storage --project webbi-85f26

# terminal 2
NEXT_PUBLIC_FIREBASE_EMULATOR=1 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
AI_PROVIDER=mock PAYMENT_PROVIDER=mock npm run dev
```

Emulator UI: http://127.0.0.1:4000. `AI_MOCK_DELAY_MS` slows the mock AI down if you want to see the loading states. Neither mock is ever used in a production build.

If the browser logs `Could not reach Cloud Firestore backend` after several full page reloads in one tab, that's Chrome's six-connection cap per host against the HTTP/1.1 emulator (old pages in the back/forward cache keep their Firestore channels open). Open a new tab, or start Chrome with `--disable-features=BackForwardCache`. Production Firestore speaks HTTP/2, so real visitors never hit this.

Note: Next caches the public renderer's Firestore reads in `.next/cache/fetch-cache` across restarts. Publishing invalidates the right tag, but if you reset the emulator data, delete that folder too.

## Architecture and data model

One Next.js app serves everything. Each customer website is a validated JSON document (`SiteContent` in `src/lib/site/schema.ts`: business, theme preset, call-to-action, 1–12 typed sections) rendered by the shared components in `src/components/site`. The AI never writes HTML or CSS; it fills that structure, and `siteContentSchema` rejects anything else.

| Route | What it is |
| --- | --- |
| `/` | Landing (design screen 01) |
| `/start` → `/s/{siteId}/confirm` → `/content` → `/generating` → `/ready` | Onboarding: description → "AI understands" → confirm details → generation → full free preview |
| `/s/{siteId}/edit` | Structured editor (text, photos, sections, theme preset, colour) with autosave |
| `/s/{siteId}/account` → `/publish` → `/publish/return` → `/live` | Sign in (guest sites are kept), choose slug, pay, confirm, share |
| `/dashboard`, `/signin` | Owner's sites and sign-in |
| `/w/{slug}` | Public renderer. Reads `publicSites/{slug}` (cached, invalidated on publish) or a built-in demo site |
| `/api/ai/understand`, `/api/ai/generate` | Server-only AI calls (Anthropic key never reaches the browser) |
| `/api/publish/slug`, `/checkout`, `/confirm`, `/republish` | Slug availability, Stripe Checkout session, payment confirmation, push edits to a paid site |
| `/api/payments/webhook` | Stripe webhook (signature verified) |

Sessions are anonymous-first: a visitor can build and preview a site as a Firebase anonymous user, and the account created at Publish links to that same user, so nothing is lost.

Firestore collections (rules in `firestore.rules`):

| Collection | Who can read / write | Contents |
| --- | --- | --- |
| `users/{uid}` | owner | profile |
| `sites/{siteId}` | owner reads; owner may update only `draft`, `sourceDescription`, `generation`, `language`, `updatedAt` | draft content, flow status, `slug`/`paid`/`published` (server-only) |
| `publicSites/{slug}` | world-readable, server-only writes | the published copy of a site, plus `siteId` (never the owner) |
| `slugs/{slug}` | server-only | slug → siteId reservation, claimed inside the payment transaction |
| `payments/{id}` | owner reads, server-only writes | one record per checkout: provider, amount, status |

Photos go to Storage at `users/{uid}/sites/{siteId}/…` (owner-only through the rules; the app stores tokenised download URLs, which is what the public renderer uses). Unpublished sites are never readable by anyone but their owner.

Demo sites (`/w/rasa-kampung`, `/w/hafiz-rahman`) are defined in code in `src/lib/site/demo.ts`, are `noindex`, and their slugs are reserved so a customer can't claim them.

## Configuration

Public Firebase values (`NEXT_PUBLIC_FIREBASE_*`) are safe to expose and are governed by the security rules. The following are server-only and must never be committed:

| Variable | Needed for | How to get it |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | AI routes, slug claims, publishing, payment verification | Firebase Console → Project settings → Service accounts → Generate new private key, then `base64 -i key.json \| tr -d '\n'`. Locally you can instead run `gcloud auth application-default login`. |
| `ANTHROPIC_API_KEY` | "AI understands" + site generation | console.anthropic.com → API keys |
| `ANTHROPIC_MODEL` | model override (default `claude-sonnet-5`) | optional |
| `PAYMENT_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Publish → payment | See "Payments" below. With `PAYMENT_PROVIDER=none` the Publish screen explains that payments are not switched on yet; nothing is ever marked paid or published without a verified payment. |

Firebase Authentication must be enabled once in the Firebase Console (Authentication → Get started) with the **Anonymous**, **Google** and **Email/Password** providers, and the Netlify domain added under Authorized domains.

## Payments

Payment is one RM149.90 charge at Publish, taken through Stripe Checkout (hosted page). The provider boundary is `src/lib/payments/`: `provider.ts` is the interface, `stripe.ts` the only production adapter, `mock.ts` a dev-only stand-in. Everything else in the app talks to the interface.

How a site goes live, and why it can't be faked:

1. `POST /api/publish/checkout` records a **pending** `payments/{id}` document and opens a Stripe Checkout session (amount and currency fixed server-side).
2. Stripe calls `POST /api/payments/webhook` (signature verified) **and** the customer returns to `/s/{siteId}/publish/return`, which calls `POST /api/publish/confirm`. Both paths ask Stripe for the session's real status.
3. Only a `paid` answer from Stripe reaches `fulfilPayment` (`src/lib/site/publish.ts`): one Firestore transaction that checks the amount, claims the slug (falling back to `-2` … `-6` if it was just taken), copies the validated draft to `publicSites/{slug}` and marks the site paid + published. It is idempotent, so webhook and return page can race safely.
4. Firestore rules never let a client write `status`, `paid`, `slug` or `published`.

Setting it up:

1. Stripe Dashboard → Settings → Payment methods: enable **FPX**, **Cards** and **GrabPay** for MYR.
2. Developers → API keys: `STRIPE_SECRET_KEY` (server) and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
3. Developers → Webhooks → add endpoint `https://<your-domain>/api/payments/webhook` for the events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`; copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Set `PAYMENT_PROVIDER=stripe`. Locally, forward webhooks with `stripe listen --forward-to localhost:3000/api/payments/webhook`.

Owners can push later edits to a paid site with **Publish changes** in the editor (`POST /api/publish/republish`); no second payment.

## Tests and QA

```bash
npm test          # unit tests (vitest): slug rules, flow resume logic, schema, phone/link helpers, env parsing
npm run lint
npx tsc --noEmit
npm run build
```

End-to-end check of the whole product against the emulators (needs the emulator + mock-provider dev server from "Local dev without real credentials" running, and Google Chrome installed):

```bash
QA_BASE_URL=http://localhost:3000 npm run qa:publish
```

`scripts/qa/publish-flow.mjs` drives a phone-sized headless Chrome through onboarding, guest → account, slug validation, mock payment, the live page, the public `/w/{slug}` page as a signed-out visitor, "Publish changes" from the editor, the dashboard, slug collisions, cancelled checkouts and bogus return sessions, and checks the resulting Firestore documents. Screenshots land in `scripts/qa/shots/`. Set `QA_CHROME` if Chrome isn't at the default macOS path.

## Deploying rules and indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project webbi-85f26
```

## Deploying to Netlify

The Netlify site is `webbi-my` (https://webbi-my.netlify.app). It is **not** linked to the GitHub repo, so deploys are manual:

```bash
npx netlify login            # once
npx netlify link             # once, pick webbi-my
npx netlify deploy --build --prod
```

Environment variables to set under Site configuration → Environment variables (all of `.env.example` except the emulator block): the six `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_SITE_URL` (the real public origin, no trailing slash), `FIREBASE_SERVICE_ACCOUNT_BASE64`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `PAYMENT_PROVIDER` and the three Stripe keys. `NODE_VERSION=22` is set in `netlify.toml`.

### Before launch

1. Firebase Console → Authentication → Sign-in method: enable **Anonymous**, **Google**, **Email/Password**; Settings → Authorized domains: add the Netlify domain (and the custom domain later).
2. Firebase Console → Project settings → Service accounts → generate a key → `FIREBASE_SERVICE_ACCOUNT_BASE64` on Netlify. Without it every `/api/*` route fails with a clear "server not configured" error.
3. `ANTHROPIC_API_KEY` on Netlify (`AI_PROVIDER` unset or `anthropic`).
4. Stripe keys + webhook as described under "Payments", then `PAYMENT_PROVIDER=stripe`. Until then the Publish screen honestly says payments aren't on yet.
5. `firebase deploy --only firestore:rules,firestore:indexes,storage --project webbi-85f26` (already deployed once; re-run after changing rules).
6. Netlify → Site configuration → Site protection: turn off team-only access so customers' sites are public.
7. `NEXT_PUBLIC_SITE_URL` must match the domain customers will see in their share links.

## Design

The design source of truth is the Claude Design pack in `claude design webbi/`. Tokens live in `src/app/globals.css`; UI primitives in `src/components/ui`.
