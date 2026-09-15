# Webbi

AI website generator for Malaysian small businesses. Describe your business in one sentence (BM or English), preview the finished website free, pay RM149.90 once to publish it at `webbi.online/w/your-business`.

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
| `/s/{siteId}/account` → `/publish` → `/publish/return` → `/live` | Sign in, verify the email address (Google accounts don't need to), choose slug, pay, confirm, share |
| `/dashboard`, `/signin` | Owner's sites and sign-in |
| `/w/{slug}` | Public renderer. Reads `publicSites/{slug}` (cached, invalidated on publish) or a built-in demo site |
| `/api/sites`, `/api/sites/delete` | Start a website (one unpublished website per account, 3 starts a day) and delete an unpaid draft |
| `/api/sites/images?siteId=…` | The only way a photo reaches Storage: checked, stored and counted on the server |
| `/api/ai/understand`, `/api/ai/generate` | Server-only AI calls for one of the caller's own drafts: the browser sends only `{ siteId }` and the server builds the request from the saved site (the OpenAI key never reaches the browser) |
| `/api/publish/slug`, `/checkout`, `/confirm`, `/republish` | Slug availability, Billplz bill creation, return-page payment confirmation, push edits to a paid site |
| `/api/payments/webhook` | Billplz payment callback (X Signature verified) |

Starting a website needs a signed-in Google or email/password account (Anonymous sign-in is disabled; a leftover anonymous session is treated as signed out in the app and refused by the API). `POST /api/sites` runs one Admin SDK transaction on `userQuotas/{uid}`: it refuses with 409 while the account has an unpublished site (pending, failed or unpaid payments included) and with 429 after 3 starts in the current Malaysia day. Publishing (a verified payment) or deleting the draft frees the slot; deleting never gives back a start. Accounts that already had several drafts before this limit keep all of them untouched; their oldest draft (by `createdAt`) is treated as the one in progress until it is published or deleted.

AI cost protection (`src/lib/ai/guard.ts`). The only code that reaches a model provider is `runAiJob`, used by the two AI routes. Each request:

1. needs a signed-in account (401 without one, 403 for an anonymous session), passes App Check when `APP_CHECK_MODE=enforce` (401), and names a website that exists (404), belongs to the caller and isn't published (403);
2. is rebuilt from what is saved on that site: the description, the confirmed details, the language. Nothing else in the body is read, so the browser can't choose the model, the prompt or `max_completion_tokens`;
3. passes one Firestore transaction that refuses with **409** while another AI request for the same website holds its lock, and **429** once the website has had 3 reads of its description or 3 builds (the first plus two rebuilds), or the account has made **10 AI requests today** or **30 this month** (Malaysia calendar day and month; reading a description and building a website share that allowance), or **all of Webbi** has used its AI budget for today or this month (see below). A refused request calls nothing and counts nothing;
4. takes the lock and counts the request (on the account, the website and the Webbi-wide budget) in that same transaction, and only then calls the provider;
5. saves the result on the site and releases the lock in a second transaction. A lock left behind by a request that died (a crash, or the platform stopping the function) is taken over after 2 minutes.

An accepted request that fails still counts (a timeout, a provider error or an unusable answer), since the provider may already have billed it. It is given back only when the provider turned it away before doing any work: no key, a rejected key, an unknown model, no credit left, or rate limited. Providers retry at most once. The build allows up to 16,384 output tokens: a full draft can reach about 10,000 tokens of JSON, plus reasoning tokens. Responses never include provider messages, keys, setting names or stack traces.

**Webbi-wide AI budget.** Per-account limits don't stop many accounts together from running up the bill, so the same transaction also counts every request in `aiBudget/day-{YYYY-MM-DD}` and `aiBudget/month-{YYYY-MM}` (server-only documents). Defaults are **500 a day** and **6,000 a month**; set `AI_GLOBAL_DAILY_LIMIT` / `AI_GLOBAL_MONTHLY_LIMIT` to change them (not a whole number = the default, `0` = AI off). It fails closed: a counter that can't be read as a number refuses the request. The user sees only "Webbi's AI is busy right now. Please try again later." (429 `rate_limited`); the function log says `[ai] Webbi-wide AI budget reached` with the scope. A request the provider turned away before doing any work is given back to the budget as well.

Tradeoff: every AI request in the whole product now writes the same two documents, so AI requests are serialised through them. Firestore sustains roughly one write per second per document before contention retries and latency grow; at today's volume (well under that, since a generation takes several seconds) this costs nothing. If AI traffic ever approaches about one request per second, shard the counters (e.g. `day-{date}-{0..N}` summed on read) or move the budget to a dedicated counter service.

**Operational spending cap.** The limits above cap requests, not money. Set a hard monthly ceiling on the OpenAI side as well: in the OpenAI platform dashboard, set the project's monthly budget and usage limits (Settings → Limits / Billing; the wording may change), and prefer prepaid credits with auto-recharge off, so spend stops when the credit runs out. The key and the ceiling live only in the OpenAI dashboard and the server environment, never in this repository.

Firestore collections (rules in `firestore.rules`):

| Collection | Who can read / write | Contents |
| --- | --- | --- |
| `users/{uid}` | owner | profile |
| `sites/{siteId}` | owner reads; owner may update only `draft`, `sourceDescription`, `generation`, `language`, `updatedAt`, and not at all while suspended; create and delete are server-only (`/api/sites`) | draft content, flow status, `slug`/`paid`/`published`/`moderationStatus` (server-only) |
| `siteModeration/{siteId}` | server-only | why a website was suspended (see Moderation) |
| `userQuotas/{uid}` | server-only | `openDraftSiteId` (the account's one unpublished website), `draftsCreatedToday` / `draftsDay` (Malaysia calendar day), AI requests `aiRequestsToday` / `aiDay` and `aiRequestsThisMonth` / `aiMonth`, and photo uploads `uploadsToday` / `uploadsDay` |
| `siteAi/{siteId}` | server-only | one small document per website: `understandings`, `generations` and the AI `lock`; deleted with the draft |
| `aiBudget/{period}` | server-only | Webbi-wide AI request `count` for `day-{YYYY-MM-DD}` and `month-{YYYY-MM}` (Malaysia time) |
| `publicSites/{slug}` | anyone can get one by its link, nobody can list; server-only writes | the published copy of a site, plus `siteId` (never the owner); a content-free marker while suspended |
| `slugs/{slug}` | server-only | slug → siteId reservation, claimed inside the payment transaction |
| `payments/{id}` | owner reads, server-only writes | one record per checkout: provider, amount, status |

Unpublished sites are never readable by anyone but their owner.

Photo uploads (`src/lib/images/storage.ts`). The browser resizes a photo (1600px WebP, as before) and POSTs its bytes to `/api/sites/images?siteId=…`. `storage.rules` refuse every browser write and delete, the owner's included, so this route is the only way in. Each upload:

1. needs a signed-in account (401 without one, 403 for an anonymous session), passes App Check when `APP_CHECK_MODE=enforce` (401), and a website that exists (404), belongs to the caller (403) and is a draft or a paid live site (the editor changes live sites before a republish);
2. is at most **5 MB** (413; the body is read in a stream and dropped at the limit);
3. is a **JPEG, PNG or WebP by its bytes**: the file signature and header are parsed (`src/lib/images/sniff.ts`, no image library), and the declared Content-Type must match what the bytes are (415). SVG, HTML, anything disguised as an image and unreadable headers are refused. Rules can't read file bytes, which is why the check lives on the server and browsers can't write at all;
4. counts against **50 uploads a Malaysia day per account** (429). The count is taken in a transaction and given back if the upload then fails; refused uploads never count, and removing a photo never gives one back;
5. is stored at `users/{uid}/sites/{siteId}/img_{random}.{jpg|png|webp}`, a path built only from the verified uid, the checked site id and a random name. File names, paths, uids or folders sent by the browser are ignored and never echoed back. The response is `{ url, path, width, height }` with the usual tokenised Firebase download URL (the bucket stays private; published pages use the same URLs as before).

Old photos are never deleted when one is replaced or removed, because the live page, an unsaved editor change or the details step may still show them. Instead, each upload clears files in that website's folder that none of the owner's websites reference (draft, published copy, confirmed details) and that are more than a day old. After that sweep a website may hold at most **100 files** (429). Deleting a draft (`/api/sites/delete`) removes its folder, keeping any file another of the owner's websites still references; if Storage fails at that point the draft is still deleted, the error is logged and the files stay behind (harmless, private, unlisted). Nothing lists Storage when a page renders.

Files uploaded before this change (then allowed: any `image/*` up to 8 MB, straight from the browser) are left as they are; a few may be SVGs. They are served from Firebase's domain, not Webbi's, and the image optimiser refuses SVG. `next.config.ts` only lets the optimiser fetch `https://firebasestorage.googleapis.com/v0/b/{this project's bucket}/o/…`; any other image address in a draft shows as a broken image rather than being fetched.

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
| `AI_GLOBAL_DAILY_LIMIT`, `AI_GLOBAL_MONTHLY_LIMIT` | Webbi-wide AI budget | optional; defaults 500 / 6000, `0` turns the AI off (see "AI cost protection") |
| `APP_CHECK_MODE` | App Check on the server: `off` \| `monitor` \| `enforce` | optional, default `off` (see "App Check") |
| `ADMIN_HOSTS`, `ADMIN_PANEL_ENABLED` | the owner admin panel: which hosts serve `/admin`, and its kill switch | optional; defaults `webbi.online` and on (see "Admin panel") |
| `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` | App Check in the browser (reCAPTCHA Enterprise site key; public) | Firebase Console → App Check. `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN` is for local development only |
| `PAYMENT_PROVIDER`, `BILLPLZ_SECRET_KEY`, `BILLPLZ_COLLECTION_ID`, `BILLPLZ_X_SIGNATURE_KEY`, `BILLPLZ_BASE_URL` | Publish → payment | See "Payments" below. With the three Billplz keys set and `PAYMENT_PROVIDER` unset, Billplz takes payments; with `PAYMENT_PROVIDER=none` (or no keys) the Publish screen explains that payments are not switched on yet. Nothing is ever marked paid or published without a verified payment. `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are only for the Stripe reference adapter. |

Firebase Authentication must be enabled once in the Firebase Console (Authentication → Get started) with the **Google** and **Email/Password** providers only (**Anonymous must be off**), **email enumeration protection** on, and the Netlify domain added under Authorized domains.

### Email verification

Email/password accounts get a Firebase verification email right after sign-up (`sendEmailVerification`, continuing to `/dashboard`). Until they click it they can build, edit and preview, but not publish. Google accounts are treated as verified and never see a prompt. The form only trims the address and checks it is plausibly shaped; free providers (`try@yahoo.com`, Gmail, Outlook…) are normal addresses.

- **Browser** (`EmailVerificationNotice`): "Please verify your email before publishing your website." with the address, **Resend email** (60 s cooldown, also after Firebase's `too-many-requests`) and **I've verified** (reloads the user and forces a fresh ID token). Shown on the dashboard, the Publish screen (Pay disabled) and the payment return page. Nobody is signed out.
- **Server, token claims** (`assertMayPublish`, `src/lib/auth/publishing.ts`): `/api/publish/checkout` and `/api/publish/republish` answer **403 `email_unverified`** unless the ID token says `email_verified` or the account has a `google.com` identity.
- **Server, Firebase Auth record** (`publishStanding`, `src/lib/auth/accounts.ts`, Identity Toolkit `accounts:lookup` with the Admin credential): every fulfilment path (payment callback, return-page confirm, Pay again on a paid payment, open-bill reuse, `retryPaymentFulfilment`, draft deletion's settle) asks Auth itself before publishing, because the callback carries no user token. An unverified (or disabled, or missing) owner's payment is kept **paid** with `needsAttention: true`, `attentionReason: "email_unverified"`: not failed, not refunded, website not published, draft slot held. Once they verify, pressing Pay again (no new bill), a repeated callback or a retry publishes that same payment. If Auth can't be reached the payment is held as `fulfilment_error` (transient, the callback gets a 500 so Billplz retries); it never publishes on a failed lookup.

Existing unverified email/password accounts are not signed out or deleted; they see the prompt and must verify before their next publish or republish.

### App Check

Client: `src/lib/firebase/appCheck.ts` starts App Check with **reCAPTCHA Enterprise** (invisible, score-based; no CAPTCHA to click) only when `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` is set and the emulators aren't in use, and `src/lib/api/client.ts` / the photo upload add `X-Firebase-AppCheck` to API calls. If a token can't be had the request goes out without one. The CSP only allows reCAPTCHA and App Check hosts when the site key is set.

Server: `requireAppCheck` (`src/lib/security/appCheck.ts`) verifies the token with `jose` against App Check's public JWKS (issuer `https://firebaseappcheck.googleapis.com/{projectNumber}`, audience `projects/{projectNumber}`, subject = this web app id). It guards `POST /api/sites`, `/api/sites/images` and both AI routes. Payment callbacks and the return page are deliberately not guarded (Billplz and slow redirects can't carry a token; they are protected by signatures). Sign-in itself is protected by Firebase Auth's own App Check enforcement in the Console, not by Webbi's server.

Rollout: `APP_CHECK_MODE=off` (default: dev, tests, emulators need nothing) → set the site key and `monitor` (logs `[app-check] would refuse` with route and reason, lets requests through) → watch the logs and App Check metrics for a few days → `enforce` (401 `app_check_failed`, "We couldn't verify this browser. Refresh the page and try again."). Rollback is `APP_CHECK_MODE=off` (Netlify applies a changed variable on the next deploy). Keep Firebase Console enforcement for Authentication, Firestore and Storage off until monitor-mode metrics show nearly all requests verified; enforcing there blocks the browser SDK directly, which Webbi's server can't soften.

## Payments

Payment is one RM149.90 charge at Publish, collected by **Billplz** through its production API (`https://www.billplz.com/api/`). The provider boundary is `src/lib/payments/`: `provider.ts` is the interface, `billplz.ts` the live adapter, `stripe.ts` a reference adapter (Stripe Checkout) and `mock.ts` a dev-only stand-in that is refused in production. Everything else in the app talks to the interface.

How a site goes live, and why it can't be faked:

1. `POST /api/publish/checkout` (a signed-in account, its own draft) records a **pending** `payments/{id}` document, then creates the bill on the server: `amount=14990` (RM149.90 in sen, from `PRICE_SEN`; the browser never sends a price), the configured collection, the account's name and email, `reference_1` = payment id, `reference_2` = site id, `callback_url` = `{NEXT_PUBLIC_SITE_URL}/api/payments/webhook` and `redirect_url` = `{NEXT_PUBLIC_SITE_URL}/s/{siteId}/publish/return`. The bill id is saved on the payment, and the bill Billplz returns must match the collection and the amount.
2. Billplz POSTs the outcome to `/api/payments/webhook`. **This callback is the proof of payment.** Every field is checked against its X Signature (HMAC-SHA256 with `BILLPLZ_X_SIGNATURE_KEY`, compared in constant time); anything unsigned or edited gets a 400 and changes nothing, and a bill from another collection is ignored.
3. The customer's browser comes back to `/s/{siteId}/publish/return`, which calls `POST /api/publish/confirm`. The redirect proves nothing on its own: its `billplz[x_signature]` must verify and name the bill being confirmed, and even then the server reads the bill back from the Billplz API and checks that the payment belongs to this account and this website. Until then the page says "We're confirming your payment."
4. Only a bill Billplz reports as paid (`paid=true`, `state=paid`) reaches `fulfilPayment` (`src/lib/site/publish.ts`), the one path shared by the callback and the return page. It runs in two idempotent transactions:
   - **Record.** The bill must map to its payment record (bill id, `reference_1`, and `reference_2` = the record's site); otherwise nothing is recorded (`refused`). The payment becomes `paid` with `paidAt`, `paidAmountSen` and the bill id, and it is never downgraded afterwards.
   - **Publish.** Claims the slug (falling back to `-2` … `-6` if it was just taken, never overwriting another site), copies the validated draft to `publicSites/{slug}`, marks the site paid + published with its `paymentId`, sets `fulfilledAt` on the payment and only then frees the owner's draft slot.
   - Repeated callbacks, repeated return visits, and both at once publish exactly once. A due bill publishes nothing; a deleted bill is recorded as `failed`.
5. **Paid but not live** is `status: "paid"` + `needsAttention: true` with an `attentionReason`: `invalid_draft`, `slug_unavailable`, `fulfilment_error` (transient; the callback gets a 500 so Billplz calls again), `amount_mismatch`, `site_missing`, `owner_mismatch` or `duplicate` (a second paid bill for a site already live, which publishes nothing). It is never marked failed, the draft slot stays held, and the draft can't be deleted. Recovery:
   - The owner fixes the draft or picks a new link and presses Pay again. Checkout sees the paid payment and publishes it without a new bill.
   - Otherwise, a repeated callback does it.
   - On the server, `retryPaymentFulfilment(paymentId)` does the same (never for an unpaid payment), and `paymentsNeedingAttention()` lists what to retry or refund.

   Refunds (`amount_mismatch`, `duplicate`, `site_missing`) are done by hand in Billplz. There is no automatic refund and no public retry endpoint.
6. One open bill per website: pressing Pay again asks Billplz about the site's newest pending bill and reuses it while it is still due. A deleted or unknown bill gets a new one, and the old record is kept (deleted bills as `failed`), never marked paid without Billplz saying so. Deleting a draft first asks Billplz about its open bills: one paid a moment ago publishes instead, and a due one is closed as `failed` (`site_deleted`). If it is paid anyway later, it is kept as paid + `site_missing` for a refund.
7. Firestore rules never let a client write `status`, `paid`, `slug` or `published`, and `payments` are server-only writes.

Setting up Billplz:

1. In the Billplz account (production, not sandbox): pick the collection for Webbi sales and make sure **X Signature** is switched on. Without it every callback and return link is rejected and nothing publishes.
2. Set `BILLPLZ_SECRET_KEY`, `BILLPLZ_COLLECTION_ID`, `BILLPLZ_X_SIGNATURE_KEY` and `BILLPLZ_BASE_URL=https://www.billplz.com/api/` as server-side variables (never `NEXT_PUBLIC_`). With `PAYMENT_PROVIDER` unset the three keys switch Billplz on; `PAYMENT_PROVIDER=none` keeps payments off. A sandbox base URL is refused in production.
3. `NEXT_PUBLIC_SITE_URL` must be the public https origin: it builds each bill's callback and redirect URLs, and production refuses to create a bill that would call back to localhost or plain http.
4. `npm test` runs the whole flow against a faked Billplz API with made-up keys; it never calls Billplz.

Stripe (reference adapter, `PAYMENT_PROVIDER=stripe`): enable **FPX**, **Cards** and **GrabPay** for MYR; set `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`; add a webhook endpoint `https://<your-domain>/api/payments/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `checkout.session.expired`, and put its signing secret in `STRIPE_WEBHOOK_SECRET`. Locally, `stripe listen --forward-to localhost:3000/api/payments/webhook`.

Owners can push later edits to a paid site with **Publish changes** in the editor (`POST /api/publish/republish`); no second payment.

## Tests and QA

```bash
npm test          # unit tests (vitest): slug rules, flow resume logic, schema, phone/link helpers, env parsing, Billplz payments, website limits, AI limits and locks, photo uploads (providers and Storage faked; no real AI calls)
npm run test:rules  # Firestore + Storage rules, real-transaction race tests and the upload route with the real Admin SDK, against the Firestore and Storage emulators (needs Java and the firebase CLI)
npm run lint
npx tsc --noEmit
npm run build
```

End-to-end check of the whole product against the emulators (needs the emulator + mock-provider dev server from "Local dev without real credentials" running, and Google Chrome installed):

```bash
QA_BASE_URL=http://localhost:3000 npm run qa:publish
```

`scripts/qa/publish-flow.mjs` drives a phone-sized headless Chrome through sign-up (the email is verified through the Auth emulator's `oobCodes` endpoint), onboarding, slug validation, mock payment, the live page, the public `/w/{slug}` page as a signed-out visitor, "Publish changes" from the editor, the dashboard, slug collisions, cancelled checkouts and bogus return sessions, and checks the resulting Firestore documents. Screenshots land in `scripts/qa/shots/`. Set `QA_CHROME` if Chrome isn't at the default macOS path.

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

The owner admin panel against the same emulator dev server (the Auth emulator's Google widget signs the owner in; the script grants and revokes the role with `ops:admin-role` itself):

```bash
QA_BASE_URL=http://localhost:3000 npm run qa:admin   # owner sees every section, normal user and other hosts get not-found, signed-out redirect, no leaks, headers, 400px
```

Security headers against a production server (`next dev` adds dev-only allowances, so check with `next start`):

```bash
npm run build && npx next start
QA_SITE_SLUGS=some-published-slug npm run qa:headers   # headers on pages and API, no CORS grant, framing blocked, CSP violations in Chrome, photos + Maps on /w/ pages
```

Each `qa:industries` / `qa:publish` run against the real project leaves Auth users and their draft `sites` docs behind. `npm run qa:cleanup` lists them (dry run; needs `gcloud auth login`), and `npm run qa:cleanup -- --apply` deletes them. It only removes users with no sign-in provider or email (older anonymous QA users), their draft sites, and orphaned `users` docs; the `qa-…@example.com` email accounts QA now creates must be deleted in the Console. Against the real project the QA email can't be verified automatically, so run the publish QA against the emulators.

## Security headers

Set in one place: `src/lib/security/headers.ts`, applied by `headers()` in `next.config.ts` (nothing in `netlify.toml`, no middleware). Every response gets HSTS (`max-age=31536000`, no `includeSubDomains`/`preload` until the custom domain is settled), `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a Permissions-Policy that turns off camera, microphone, geolocation, payment and similar, `X-Frame-Options: DENY` and a CSP with `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`.

- **App** (everything except `/w/` and `/api/`): scripts from Webbi plus `apis.google.com` (Firebase's Google sign-in loader); connections to Firebase Auth and Firestore; frames from the Firebase auth domain and Google Maps; images from Webbi, `data:`/`blob:` and Firebase Storage.
- **Customer sites** (`/w/{slug}`): Webbi's own scripts only, no external connections, frames only from Google Maps.
- **API** (`/api/`): `default-src 'none'` and `Cache-Control: private, no-store`. No route sends `Access-Control-Allow-*`; the Billplz callback needs none (server to server).
- **Firebase Auth handler** (`/__/auth/…`, proxied to Firebase, see "Google sign-in domain"): Next.js passes Firebase's response through with Firebase's own headers (`cache-control: max-age=1800` and `strict-transport-security: max-age=31556926; includeSubDomains; preload`), and none of the rules above apply to it. So there is no CSP and no `X-Frame-Options` there, as on firebaseapp.com: the SDK frames `/__/auth/iframe` (also from the netlify.app fallback domain) and the handler runs Google's scripts. The header rules also exclude that path, so a response Next.js makes itself there never gets the app's framing block either. Nothing else lives under that path. Note that Firebase's HSTS includes `includeSubDomains`: once browsers load the handler from webbi.online, every `*.webbi.online` subdomain must serve HTTPS (Netlify and Firebase Hosting both do).

`'unsafe-inline'` is allowed for scripts and styles because Next.js streams inline `<script>` payloads and a nonce would force every page to render dynamically (losing the static, CDN-cached landing). Scripts are still limited by origin, and customer content is never rendered as HTML. Adding a third-party script, font, image host, iframe or API called from the browser means adding its origin in `headers.ts`, or the browser blocks it. Links from a `/w/` page into the app are plain `<a>` (full page load), because a client-side navigation would keep the site's stricter policy.

## Google sign-in domain

Google's account chooser names the host of Firebase's sign-in handler, `https://<NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN>/__/auth/handler`: with `webbi-85f26.firebaseapp.com` it says "to continue to webbi-85f26.firebaseapp.com". To make it say webbi.online, Webbi follows Firebase's documented reverse-proxy setup ([option 3](https://firebase.google.com/docs/auth/web/redirect-best-practices)):

- `next.config.ts` rewrites `/__/auth/*` to `https://<NEXT_PUBLIC_FIREBASE_PROJECT_ID>.firebaseapp.com/__/auth/*` (`src/lib/firebase/authHandler.ts`). It is a transparent proxy, not a redirect, and only that path. It has to be a Next.js rewrite: on Netlify the Next.js function answers every path before `netlify.toml` rules are read. The target is built from the project id, never from the auth domain, so it can't loop.
- The proxy is harmless while the auth domain is still firebaseapp.com, so it ships first. Switching happens in this order:
  1. Deploy, then check `https://webbi.online/__/auth/handler` and `https://webbi.online/__/auth/iframe` return 200 HTML without `X-Frame-Options` or a CSP.
  2. Google Cloud Console (project `webbi-85f26`) → APIs & Services → Credentials → OAuth 2.0 client "Web client (auto created by Google Service)" (`555593585084-1dgn4h89gbvi8ditg3csdrif9qu0rm82.apps.googleusercontent.com`): add the authorized redirect URI `https://webbi.online/__/auth/handler` and the authorized JavaScript origin `https://webbi.online`. Keep `https://webbi-85f26.firebaseapp.com/__/auth/handler`.
  3. Firebase Console → Authentication → Settings → Authorized domains must list `webbi.online` (it does).
  4. Netlify production `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=webbi.online`, then redeploy (it is inlined at build time).
- Rollback: set `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` back to `webbi-85f26.firebaseapp.com` and redeploy. Same project, same Google client, so accounts and user ids don't change either way.
- Builds served from webbi-my.netlify.app use the same auth domain, so their sign-in popup is cross-origin to webbi.online, exactly as it was to firebaseapp.com.

## Deploying rules and indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project webbi-85f26
```

Deploy `storage.rules` together with the app code that adds `/api/sites/images`: the new rules refuse browser uploads, so rules ahead of the code break uploads, and code without the rules leaves direct browser uploads open.

## Deploying to Netlify

Production is **https://webbi.online** (the Netlify primary domain; `www.webbi.online` redirects to it). The Netlify project is `webbi-my`, and https://webbi-my.netlify.app is its fallback project domain. Keep that address working: bills opened before a domain change call back to it. The site is linked to the GitHub repo, so every push to `main` deploys. A manual deploy is still possible:

```bash
npx netlify login            # once
npx netlify link             # once, pick webbi-my
npx netlify deploy --build --prod
```

Environment variables to set under Site configuration → Environment variables (all of `.env.example` except the emulator block): the six `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_SITE_URL` (the real public origin, no trailing slash), `FIREBASE_SERVICE_ACCOUNT_BASE64`, `OPENAI_API_KEY` (optionally `OPENAI_MODEL`) and the four Billplz variables `BILLPLZ_SECRET_KEY`, `BILLPLZ_COLLECTION_ID`, `BILLPLZ_X_SIGNATURE_KEY`, `BILLPLZ_BASE_URL` (leave `PAYMENT_PROVIDER` unset, or set it to `billplz`). `NODE_VERSION=22` is set in `netlify.toml`.

### Before launch

1. Firebase Console → Authentication → Sign-in method: enable **Google** and **Email/Password**, keep **Anonymous disabled**; Settings → User actions: **Email enumeration protection** on; Settings → Authorized domains: `webbi.online` and `www.webbi.online` (already added) and the Netlify domain.
2. Firebase Console → Project settings → Service accounts → generate a key → `FIREBASE_SERVICE_ACCOUNT_BASE64` on Netlify (set as a **secret**, which Netlify only allows for the production / deploy-preview / branch-deploy contexts). Already set. Without it every `/api/*` route answers 503 `admin_not_configured` (the details go to the function log, not the response).
3. `OPENAI_API_KEY` on Netlify (`AI_PROVIDER` unset or `openai`). Already set.
4. Payments: Billplz, production API. The four `BILLPLZ_*` variables are set on Netlify, and with `PAYMENT_PROVIDER` unset they switch payments on. X Signature must be on in the Billplz account (see Payments). `PAYMENT_PROVIDER=none` is the off switch; `mock` is refused in production builds.
5. `firebase deploy --only firestore:rules,firestore:indexes,storage --project webbi-85f26` (already deployed once; re-run after changing rules).
6. Netlify → Site configuration → Site protection: turn off team-only access so customers' sites are public.
7. `NEXT_PUBLIC_SITE_URL=https://webbi.online` in the production context: it is the domain in share links and in each new bill's callback and return URLs. It is inlined at build time, so redeploy after changing it.
8. Optional: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=webbi.online` so Google sign-in names Webbi, only after the OAuth redirect URI is added (see "Google sign-in domain").

## Admin panel

`https://webbi.online/admin` is a **read-only** view of Webbi for its owner: overview, users, websites, payments, AI usage, moderation and system status. It can't change anything: no suspending, refunds, payment edits, site edits or account changes (suspensions stay with `ops:moderate`, refunds in Billplz).

**Who gets in.** Only an account with the Firebase Auth custom claim `webbiRole: "owner"`. Nothing else grants it: no email list, cookie, local storage or Firestore document. Every admin API route calls `requireAdmin()` (`src/lib/admin/auth.ts`) itself, which requires, on every request:

1. `ADMIN_PANEL_ENABLED` isn't `false`, and the request's `Host` is an admin host (`src/lib/admin/hosts.ts`)
2. a Firebase ID token verified by signature, issuer, audience and expiry (the emulator's unsigned tokens are refused in production)
3. in the token: `webbiRole: "owner"`, `email_verified`, a `google.com` sign-in, and `auth_time` within the last 12 hours (older → "Sign in again")
4. App Check, per `APP_CHECK_MODE`
5. Firebase Auth right now (Identity Toolkit `accounts:lookup`): the account exists, isn't disabled, still has the role, a verified email and Google linked, and its sessions weren't revoked after this sign-in

Every refusal is the same `404 not_found` as a missing page; anyone who isn't the owner sees "Page not found", so the panel's existence isn't revealed. If Firebase Auth can't be reached the owner gets a 503, never a pass. The page HTML is an empty shell: data only comes from `/api/admin/*` after the session check, and the browser never reads Firestore for it (the rules deny `adminMetrics` and `adminAuditLogs` to every browser, the owner included).

**Hosts.** `src/proxy.ts` runs only on `/admin` and `/api/admin` and answers 404 unless the host is in `ADMIN_HOSTS` (default `webbi.online`; `localhost` is added outside production). `*.netlify.app` and local hosts are refused in production even if listed, and customer domains are never admin hosts. The proxy is only a fence; `requireAdmin()` checks the host again. A future custom-domain proxy must use `isAdminHost()` so `customer.com/admin` stays not-found.

**Data.** Accounts come from Firebase Auth (not `users/{uid}`); `sites`, `payments`, `userQuotas`, `siteAi`, `aiBudget` and `siteModeration` are read with the Admin SDK, a page at a time (25 by default, at most 50), selecting only the fields shown. Responses are built from whitelists (`src/lib/admin/dto.ts`) and refused if they contain a password hash, salt, token, credential, `checkoutUrl`, raw claims, or site content. Revenue is "collected per Webbi's records" (refunds are made in Billplz and not deducted); AI usage is a request count with no provider cost. The overview is cached in `adminMetrics/overview` for 5 minutes (manual refresh at most once a minute). OpenAI and Billplz are only checked when the owner presses "Run check".

**Audit.** `adminAuditLogs`: `ADMIN_SESSION_START` once per sign-in, and `ADMIN_ACCESS_DENIED` counted per account per hour for refusals after a valid token. Only uid, reason, route name and server timestamps; never tokens, IPs, bodies or customer content.

**Headers.** `/admin` and `/api/admin` send `X-Robots-Tag: noindex, nofollow, noarchive` and `Cache-Control: private, no-store`; robots.txt disallows `/admin`; it isn't in the sitemap or any public navigation.

**Granting the role** (CLI only; dry run without `--apply`; credentials as for `ops:moderate`; prints the project first):

```bash
npm run ops:admin-role -- status <uid>
npm run ops:admin-role -- grant <uid> --apply    # refuses a disabled, unverified or non-Google account
npm run ops:admin-role -- revoke <uid> --apply   # removes the claim and revokes the account's sessions
```

Find the uid in Firebase Console → Authentication. After granting, sign out and sign in to `https://webbi.online/admin` with Google.

**Deploying** (in this order):

1. `firebase deploy --only firestore:indexes --project webbi-85f26`, then wait until every index shows Enabled in the Console
2. `firebase deploy --only firestore:rules --project webbi-85f26` (adds the explicit `adminMetrics` / `adminAuditLogs` denies)
3. deploy the code
4. Netlify production: `ADMIN_HOSTS=webbi.online`
5. Netlify production: `ADMIN_PANEL_ENABLED=true`, redeploy
6. `npm run ops:admin-role -- grant <uid> --apply`
7. smoke test: owner sees every section on `https://webbi.online/admin`; another account sees "Page not found"; `https://webbi-my.netlify.app/admin` and `/api/admin/session` are 404

Rollback: `ADMIN_PANEL_ENABLED=false` and redeploy (every admin page and API becomes 404), and/or revoke the role.

## Moderation and takedown

A website that breaks the rules can be taken down in seconds and can't be brought back by its owner. Webbi does this by hand with the script below; there is no public endpoint, and the owner admin panel (see "Admin panel") only shows suspensions, it can't make them.

State (`src/lib/site/moderationCore.ts`):

- `sites/{siteId}.moderationStatus` is `"active"` or `"suspended"` (missing = active), with `moderatedAt`. Only the server writes it; the rules refuse any browser change, and refuse every browser edit to a suspended site.
- `siteModeration/{siteId}` keeps the internal `moderationReason` (one line, at most 500 characters). No browser can read it, the owner included. Don't put personal data or secrets in it.
- While suspended, `publicSites/{slug}` is replaced by `{ slug, suspended: true }`: no content, no site id. Every `publicSites` copy that names the site is replaced, not only its current link.

Suspend or restore (dry run first; needs Node 22.18+ for its TypeScript import and credentials for the project: `gcloud auth application-default login`, or `FIREBASE_SERVICE_ACCOUNT_BASE64` in the environment):

```bash
npm run ops:moderate -- status <siteId>
npm run ops:moderate -- suspend <siteId> "Phishing page reported 2026-09-13" --apply
npm run ops:moderate -- unsuspend <siteId> --apply
```

It runs against `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (default `webbi-85f26`) and prints the project before writing. From server code, `suspendSite` / `unsuspendSite` in `src/lib/site/moderation.ts` do the same and also clear the page cache.

What a suspension does:

- **Public URL.** `/w/{slug}` shows only "This website is currently unavailable." (`noindex`): no reason, owner, payment or ids. The script can't clear Next's cache, so the old page may be served for up to 60 seconds.
- **Publishing.** Refused everywhere, checked on the server immediately before anything is written: checkout (no bill is opened), the Billplz callback, the return page, reuse of an open bill, retry of a paid payment, and Publish changes. AI requests, photo uploads and deleting the draft are refused too; the draft stays for review, and it keeps the account's one-draft slot.
- **Payments.** Nothing is refunded or marked failed. A payment confirmed for a suspended draft stays `paid` with `needsAttention: true` and `attentionReason: "site_suspended"`, and the owner sees "can't go live right now, contact support". Refund it by hand in Billplz if the site stays down.
- **Data and images.** Nothing is deleted: the draft, the published copy on the site document, the payment records, the photos in Storage and the claimed link all stay, so nobody else can take the link. Storage photos keep their private token URLs.

Restoring puts a paid, published site's last published copy back on its link (within a minute of the cache). A payment held as `site_suspended` publishes when retried: the owner presses Pay again (no second charge), or run `retryPaymentFulfilment(paymentId)` on the server.

Abuse reports: there is no report form. Reports go to Webbi support. Check the page, suspend first if it is phishing, malware, fraud or illegal content, note the reason, and review later with the owner. Keep the report outside the repository.

Not done, and why:

- **Email verification before publishing.** Not required. Google accounts are already verified, and publishing needs a real Billplz payment by a named payer, which is a stronger check than a confirmation link and doesn't break the one-screen payment flow.
- **Link enumeration.** Browsers can no longer list `publicSites`. A guessed link still opens its page, as any public website does.

## Design

The design source of truth is the Claude Design pack in `claude design webbi/`. Tokens live in `src/app/globals.css`; UI primitives in `src/components/ui`.
