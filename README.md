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

Checks: `npm run lint`, `npx tsc --noEmit`, `npm run build`.

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

## Deploying rules and indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project webbi-85f26
```

## Design

The design source of truth is the Claude Design pack in `claude design webbi/`. Tokens live in `src/app/globals.css`; UI primitives in `src/components/ui`.
