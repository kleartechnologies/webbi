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
| `/api/sites`, `/api/sites/delete` | Start a website (one unpublished website per account, 3 starts a day) and delete an unpaid draft |
| `/api/ai/understand`, `/api/ai/generate` | Server-only AI calls (the OpenAI key never reaches the browser) |
| `/api/publish/slug`, `/checkout`, `/confirm`, `/republish` | Slug availability, Billplz bill creation, return-page payment confirmation, push edits to a paid site |
| `/api/payments/webhook` | Billplz payment callback (X Signature verified) |

Starting a website needs a signed-in account (not a guest). `POST /api/sites` runs one Admin SDK transaction on `userQuotas/{uid}`: it refuses with 409 while the account has an unpublished site (pending, failed or unpaid payments included) and with 429 after 3 starts in the current Malaysia day. Publishing (a verified payment) or deleting the draft frees the slot; deleting never gives back a start. Accounts that already had several drafts before this limit keep all of them untouched; their oldest draft (by `createdAt`) is treated as the one in progress until it is published or deleted.

Firestore collections (rules in `firestore.rules`):

| Collection | Who can read / write | Contents |
| --- | --- | --- |
| `users/{uid}` | owner | profile |
| `sites/{siteId}` | owner reads; owner may update only `draft`, `sourceDescription`, `generation`, `language`, `updatedAt`; create and delete are server-only (`/api/sites`) | draft content, flow status, `slug`/`paid`/`published` (server-only) |
| `userQuotas/{uid}` | server-only | `openDraftSiteId` (the account's one unpublished website) and `draftsCreatedToday` / `draftsDay` (Malaysia calendar day) |
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
| `OPENAI_API_KEY` | "AI understands" + site generation (production provider) | platform.openai.com → API keys. Read server-side only, in `src/lib/ai/openai.ts`. |
| `OPENAI_MODEL` | model override (default `gpt-5-mini`) | optional |
| `AI_PROVIDER` | `openai` \| `anthropic` \| `mock` | optional; unset = pick from the configured key (`OPENAI_API_KEY` first) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | alternative provider | optional; only used when `AI_PROVIDER=anthropic` or no OpenAI key is set |
| `PAYMENT_PROVIDER`, `BILLPLZ_SECRET_KEY`, `BILLPLZ_COLLECTION_ID`, `BILLPLZ_X_SIGNATURE_KEY`, `BILLPLZ_BASE_URL` | Publish → payment | See "Payments" below. With the three Billplz keys set and `PAYMENT_PROVIDER` unset, Billplz takes payments; with `PAYMENT_PROVIDER=none` (or no keys) the Publish screen explains that payments are not switched on yet. Nothing is ever marked paid or published without a verified payment. `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are only for the Stripe reference adapter. |

Firebase Authentication must be enabled once in the Firebase Console (Authentication → Get started) with the **Anonymous**, **Google** and **Email/Password** providers, and the Netlify domain added under Authorized domains.

## Payments

Payment is one RM149.90 charge at Publish, collected by **Billplz** through its production API (`https://www.billplz.com/api/`). The provider boundary is `src/lib/payments/`: `provider.ts` is the interface, `billplz.ts` the live adapter, `stripe.ts` a reference adapter (Stripe Checkout) and `mock.ts` a dev-only stand-in that is refused in production. Everything else in the app talks to the interface.

How a site goes live, and why it can't be faked:

1. `POST /api/publish/checkout` (a signed-in account, its own draft) records a **pending** `payments/{id}` document, then creates the bill on the server: `amount=14990` (RM149.90 in sen, from `PRICE_SEN`; the browser never sends a price), the configured collection, the account's name and email, `reference_1` = payment id, `reference_2` = site id, `callback_url` = `{NEXT_PUBLIC_SITE_URL}/api/payments/webhook` and `redirect_url` = `{NEXT_PUBLIC_SITE_URL}/s/{siteId}/publish/return`. The bill id is saved on the payment, and the bill Billplz returns must match the collection and the amount.
2. Billplz POSTs the outcome to `/api/payments/webhook`. **This callback is the proof of payment.** Every field is checked against its X Signature (HMAC-SHA256 with `BILLPLZ_X_SIGNATURE_KEY`, compared in constant time); anything unsigned or edited gets a 400 and changes nothing, and a bill from another collection is ignored.
3. The customer's browser comes back to `/s/{siteId}/publish/return`, which calls `POST /api/publish/confirm`. The redirect proves nothing on its own: its `billplz[x_signature]` must verify and name the bill being confirmed, and even then the server reads the bill back from the Billplz API and checks that the payment belongs to this account and this website. Until then the page says "We're confirming your payment."
4. Only a bill Billplz reports as paid (`paid=true`, `state=paid`) reaches `fulfilPayment` (`src/lib/site/publish.ts`): one Firestore transaction that matches the payment to its bill, owner and site, requires exactly 14990 sen in MYR, claims the slug (falling back to `-2` … `-6` if it was just taken), copies the validated draft to `publicSites/{slug}` and marks the site paid + published. Payments are looked up by bill id and fulfilment is idempotent, so repeated callbacks and the return page can race safely. A due bill publishes nothing; a deleted bill or a wrong amount is recorded as failed; a second paid bill for a site that is already live is recorded as a `duplicate` to refund and publishes nothing.
5. Firestore rules never let a client write `status`, `paid`, `slug` or `published`, and `payments` are server-only writes.

Setting up Billplz:

1. In the Billplz account (production, not sandbox): pick the collection for Webbi sales and make sure **X Signature** is switched on. Without it every callback and return link is rejected and nothing publishes.
2. Set `BILLPLZ_SECRET_KEY`, `BILLPLZ_COLLECTION_ID`, `BILLPLZ_X_SIGNATURE_KEY` and `BILLPLZ_BASE_URL=https://www.billplz.com/api/` as server-side variables (never `NEXT_PUBLIC_`). With `PAYMENT_PROVIDER` unset the three keys switch Billplz on; `PAYMENT_PROVIDER=none` keeps payments off. A sandbox base URL is refused in production.
3. `NEXT_PUBLIC_SITE_URL` must be the public https origin: it builds each bill's callback and redirect URLs, and production refuses to create a bill that would call back to localhost or plain http.
4. `npm test` runs the whole flow against a faked Billplz API with made-up keys; it never calls Billplz.

Stripe (reference adapter, `PAYMENT_PROVIDER=stripe`): enable **FPX**, **Cards** and **GrabPay** for MYR; set `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`; add a webhook endpoint `https://<your-domain>/api/payments/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `checkout.session.expired`, and put its signing secret in `STRIPE_WEBHOOK_SECRET`. Locally, `stripe listen --forward-to localhost:3000/api/payments/webhook`.

Owners can push later edits to a paid site with **Publish changes** in the editor (`POST /api/publish/republish`); no second payment.

## Tests and QA

```bash
npm test          # unit tests (vitest): slug rules, flow resume logic, schema, phone/link helpers, env parsing, Billplz payments, website limits
npm run test:rules  # Firestore rules + real-transaction race test against the Firestore emulator (needs Java and the firebase CLI)
npm run lint
npx tsc --noEmit
npm run build
```

End-to-end check of the whole product against the emulators (needs the emulator + mock-provider dev server from "Local dev without real credentials" running, and Google Chrome installed):

```bash
QA_BASE_URL=http://localhost:3000 npm run qa:publish
```

`scripts/qa/publish-flow.mjs` drives a phone-sized headless Chrome through onboarding, guest → account, slug validation, mock payment, the live page, the public `/w/{slug}` page as a signed-out visitor, "Publish changes" from the editor, the dashboard, slug collisions, cancelled checkouts and bogus return sessions, and checks the resulting Firestore documents. Screenshots land in `scripts/qa/shots/`. Set `QA_CHROME` if Chrome isn't at the default macOS path.

Two more harnesses cover the per-industry output against the same server:

```bash
QA_BASE_URL=http://localhost:3000 npm run qa:industries        # six categories: cards shown on the Content step, logo / profile photo / cover uploads, social handles, hero mode, preview + desktop
QA_BASE_URL=http://localhost:3000 npm run qa:profile-location  # car advisor + restaurant end to end: uploads, crop focus, social normalisation, Maps card, publish, public page at 390 / 768 / 1280, editor Remove / Replace
```

### Testing the real AI provider locally

`netlify dev` / `netlify serve` do **not** hand the functions your `OPENAI_API_KEY`: the CLI replaces `OPENAI_API_KEY` and `OPENAI_BASE_URL` with a Netlify AI Gateway token and URL (usage is billed to Netlify credits, not your OpenAI account). That token is bound to the IPv4 address the CLI used, and Node prefers IPv6, so calls fail with `403 mismatched_client_ip` unless you start the runner with IPv4 first:

```bash
NODE_OPTIONS=--dns-result-order=ipv4first npx netlify serve -p 3108 --context production
QA_BASE_URL=http://localhost:3108 npm run qa:industries
```

That exercises the real model through the real adapter, but not your own key. To test your key itself, put it in `.env.local` (git-ignored) and use the plain dev server with `AI_PROVIDER=openai`, or test the production deploy — Netlify never overrides a key you set yourself.

Each `qa:industries` / `qa:publish` run against the real project leaves anonymous Auth users and their draft `sites` docs behind. `npm run qa:cleanup` lists them (dry run; needs `gcloud auth login`), and `npm run qa:cleanup -- --apply` deletes them. It only removes users with no sign-in provider or email, their draft sites, and orphaned `users` docs.

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

Environment variables to set under Site configuration → Environment variables (all of `.env.example` except the emulator block): the six `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_SITE_URL` (the real public origin, no trailing slash), `FIREBASE_SERVICE_ACCOUNT_BASE64`, `OPENAI_API_KEY` (optionally `OPENAI_MODEL`) and the four Billplz variables `BILLPLZ_SECRET_KEY`, `BILLPLZ_COLLECTION_ID`, `BILLPLZ_X_SIGNATURE_KEY`, `BILLPLZ_BASE_URL` (leave `PAYMENT_PROVIDER` unset, or set it to `billplz`). `NODE_VERSION=22` is set in `netlify.toml`.

### Before launch

1. Firebase Console → Authentication → Sign-in method: enable **Anonymous**, **Google**, **Email/Password**; Settings → Authorized domains: add the Netlify domain (and the custom domain later).
2. Firebase Console → Project settings → Service accounts → generate a key → `FIREBASE_SERVICE_ACCOUNT_BASE64` on Netlify (set as a **secret**, which Netlify only allows for the production / deploy-preview / branch-deploy contexts). Already set. Without it every `/api/*` route fails with a clear "server not configured" error.
3. `OPENAI_API_KEY` on Netlify (`AI_PROVIDER` unset or `openai`). Already set.
4. Payments: Billplz, production API. The four `BILLPLZ_*` variables are set on Netlify, and with `PAYMENT_PROVIDER` unset they switch payments on. X Signature must be on in the Billplz account (see Payments). `PAYMENT_PROVIDER=none` is the off switch; `mock` is refused in production builds.
5. `firebase deploy --only firestore:rules,firestore:indexes,storage --project webbi-85f26` (already deployed once; re-run after changing rules).
6. Netlify → Site configuration → Site protection: turn off team-only access so customers' sites are public.
7. `NEXT_PUBLIC_SITE_URL` must match the domain customers will see in their share links.

## Design

The design source of truth is the Claude Design pack in `claude design webbi/`. Tokens live in `src/app/globals.css`; UI primitives in `src/components/ui`.
