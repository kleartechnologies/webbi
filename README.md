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

## Configuration

Public Firebase values (`NEXT_PUBLIC_FIREBASE_*`) are safe to expose and are governed by the security rules. The following are server-only and must never be committed:

| Variable | Needed for | How to get it |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | AI routes, slug claims, publishing, payment verification | Firebase Console → Project settings → Service accounts → Generate new private key, then `base64 -i key.json \| tr -d '\n'`. Locally you can instead run `gcloud auth application-default login`. |
| `ANTHROPIC_API_KEY` | "AI understands" + site generation | console.anthropic.com → API keys |
| `ANTHROPIC_MODEL` | model override (default `claude-sonnet-5`) | optional |
| `PAYMENT_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Publish → payment | Stripe dashboard. With `PAYMENT_PROVIDER=none` the Publish screen explains that payments are not configured yet; nothing is ever marked paid without a verified webhook. |

Firebase Authentication must be enabled once in the Firebase Console (Authentication → Get started) with the **Anonymous**, **Google** and **Email/Password** providers, and the Netlify domain added under Authorized domains.

## Deploying rules and indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project webbi-85f26
```

## Design

The design source of truth is the Claude Design pack in `claude design webbi/`. Tokens live in `src/app/globals.css`; UI primitives in `src/components/ui`.
