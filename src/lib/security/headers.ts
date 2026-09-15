/**
 * Webbi's browser security headers, applied by next.config.ts `headers()`,
 * the only place response security headers are set. Kept free of "@/" imports
 * so next.config.ts can load it directly.
 *
 * Two browser surfaces get two policies:
 *   app  (landing, sign-in, onboarding, dashboard, editor, payment return):
 *        Firebase Auth + Firestore in the browser, Google sign-in popup.
 *   site (/w/{slug}, customers' public websites): no Firebase SDK, no auth;
 *        only Webbi's own scripts, optimised photos and the Google Maps embed.
 * API responses are JSON and get a policy that loads nothing at all.
 * /__/auth/* is Firebase Auth's own handler, proxied from firebaseapp.com
 * (src/lib/firebase/authHandler.ts). Next.js sends a proxied response with
 * Firebase's headers as they are (these rules don't reach it), and the rules
 * keep the app's CSP and X-Frame-Options off that path regardless: either
 * would break the hidden sign-in iframe and the Google popup.
 *
 * Why 'unsafe-inline' in script-src: Next.js streams each page's React payload
 * as inline <script> tags. Allowing those without 'unsafe-inline' needs a
 * per-request nonce, and Next.js can only add a nonce to dynamically rendered
 * pages: the landing page is statically prerendered and cached at Netlify's
 * edge. A nonce also wouldn't follow client-side navigation between pages,
 * because a document keeps the policy it was loaded with. So scripts are
 * limited by origin instead (never a wildcard, never 'unsafe-eval' in
 * production). Injection itself is prevented where it would start: no
 * dangerouslySetInnerHTML (the one exception is the landing's JSON-LD, a fixed
 * object from src/lib/seo.ts), customer content is schema-validated structured
 * data rendered as escaped text, and links go through the URL helpers in
 * src/lib/site/links.ts.
 *
 * Why 'unsafe-inline' in style-src: React `style={{…}}` attributes (theme
 * colours, image frames, next/image) are inline styles, which nonces can't
 * cover.
 */

export interface SecurityHeaderOptions {
  /** `next dev`: React needs eval for its debugging, HMR uses a websocket, emulators run on http://127.0.0.1. */
  dev?: boolean;
  /**
   * NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: Firebase Auth's hidden iframe and sign-in handler live there.
   * It may be the site's own domain (proxied /__/auth/), which a copy on another domain still has to frame.
   */
  authDomain?: string;
  /**
   * NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY is set: App Check runs in the browser with
   * reCAPTCHA Enterprise, which loads Google's script and a hidden iframe and
   * exchanges its token with App Check. Off, none of those origins are allowed.
   */
  appCheck?: boolean;
}

type Directives = Record<string, string[]>;

const SELF = "'self'";
const NONE = "'none'";
const UNSAFE_INLINE = "'unsafe-inline'";

/** Photos: Webbi's uploads are Firebase Storage download URLs (public pages get them through /_next/image, which is 'self'). */
const FIREBASE_STORAGE = "https://firebasestorage.googleapis.com";
/** Firebase Auth REST endpoints: sign-in, sign-up, password reset, account lookup. */
const IDENTITY_TOOLKIT = "https://identitytoolkit.googleapis.com";
/** Firebase Auth ID token refresh. */
const SECURE_TOKEN = "https://securetoken.googleapis.com";
/** Firestore from the browser (dashboard, editor, publish screens), under firestore.rules. */
const FIRESTORE = "https://firestore.googleapis.com";
/** Google's API loader that Firebase Auth's popup sign-in injects (apis.google.com/js/api.js). */
const GOOGLE_API_LOADER = "https://apis.google.com";
/** Keyless Google Maps embed on a site's location section (…/maps?output=embed redirects within www.google.com). */
const GOOGLE_MAPS_EMBED = "https://www.google.com";

/** reCAPTCHA Enterprise for App Check: script, hidden iframe, and the App Check token exchange. Paths, never whole hosts. */
const RECAPTCHA_SCRIPTS = ["https://www.google.com/recaptcha/", "https://www.gstatic.com/recaptcha/"];
/** reCAPTCHA's fallback frame host; its main frame is on www.google.com, already allowed for Maps. */
const RECAPTCHA_FRAME_FALLBACK = "https://recaptcha.google.com/recaptcha/";
const APP_CHECK_API = "https://content-firebaseappcheck.googleapis.com";

const DEV_ORIGINS = ["http://127.0.0.1:*", "http://localhost:*"];

/** Browser capabilities Webbi never uses, on either surface. Clipboard and Web Share stay allowed (the live page and dashboard use them). */
export const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "camera=()",
  "display-capture=()",
  "geolocation=()",
  "gyroscope=()",
  "hid=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "serial=()",
  "usb=()",
  "browsing-topics=()",
].join(", ");

/**
 * HSTS without includeSubDomains or preload: Webbi doesn't yet control every
 * subdomain of its future custom domain, and preload is hard to undo. On
 * *.netlify.app, Netlify already sends its own preload-listed HSTS.
 */
export const HSTS = "max-age=31536000";

function serialize(directives: Directives): string {
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");
}

function authOrigin(authDomain: string | undefined): string[] {
  const host = authDomain?.trim().toLowerCase();
  // A bare hostname only; anything else would widen frame-src beyond Firebase Auth.
  return host && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? [`https://${host}`] : [];
}

function withDev(directives: Directives, dev: boolean | undefined): Directives {
  if (!dev) return directives;
  return {
    ...directives,
    "script-src": [...directives["script-src"], "'unsafe-eval'"],
    "img-src": [...directives["img-src"], ...DEV_ORIGINS],
    "connect-src": [...directives["connect-src"], ...DEV_ORIGINS, "ws://127.0.0.1:*", "ws://localhost:*"],
    "frame-src": [...directives["frame-src"], ...DEV_ORIGINS],
  };
}

const LOCKDOWN: Directives = {
  "object-src": [NONE],
  "base-uri": [NONE],
  "form-action": [SELF],
  "frame-ancestors": [NONE],
};

export function appCspDirectives(options: SecurityHeaderOptions = {}): Directives {
  const appCheck = options.appCheck === true;
  return withDev(
    {
      "default-src": [SELF],
      "script-src": [SELF, UNSAFE_INLINE, GOOGLE_API_LOADER, ...(appCheck ? RECAPTCHA_SCRIPTS : [])],
      "style-src": [SELF, UNSAFE_INLINE],
      "img-src": [SELF, "data:", "blob:", FIREBASE_STORAGE],
      "font-src": [SELF],
      "connect-src": [SELF, IDENTITY_TOOLKIT, SECURE_TOKEN, FIRESTORE, ...(appCheck ? [APP_CHECK_API] : [])],
      // Google Maps too: the landing opens example sites, and a client-side
      // navigation into /w/… keeps this page's policy.
      "frame-src": [...authOrigin(options.authDomain), GOOGLE_MAPS_EMBED, ...(appCheck ? [RECAPTCHA_FRAME_FALLBACK] : [])],
      ...LOCKDOWN,
    },
    options.dev,
  );
}

export function siteCspDirectives(options: SecurityHeaderOptions = {}): Directives {
  return withDev(
    {
      "default-src": [SELF],
      "script-src": [SELF, UNSAFE_INLINE],
      "style-src": [SELF, UNSAFE_INLINE],
      "img-src": [SELF, "data:", FIREBASE_STORAGE],
      "font-src": [SELF],
      "connect-src": [SELF],
      "frame-src": [GOOGLE_MAPS_EMBED],
      ...LOCKDOWN,
    },
    options.dev,
  );
}

/** JSON responses load nothing and can't be framed, even if a browser is tricked into rendering one. */
export const API_CSP = serialize({ "default-src": [NONE], "frame-ancestors": [NONE] });

export const appCsp = (options?: SecurityHeaderOptions) => serialize(appCspDirectives(options));
export const siteCsp = (options?: SecurityHeaderOptions) => serialize(siteCspDirectives(options));

export interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

/**
 * Rules for next.config.ts. Every matching rule applies and, for the same
 * header, the later rule wins: so the app policy is the default, /w/ and
 * /api/ replace just the CSP (and API responses are never cached).
 */
export function securityHeaderRules(options: SecurityHeaderOptions = {}): HeaderRule[] {
  const transport = [
    { key: "Strict-Transport-Security", value: HSTS },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
  ];
  return [
    {
      // Every path except Firebase Auth's proxied handler under /__/auth/.
      source: "/:path((?!__/auth/).*)",
      headers: [
        ...transport,
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: appCsp(options) },
      ],
    },
    {
      // Firebase's handler pages: framed by the sign-in flow (including from the
      // Netlify fallback domain) and running Google's scripts, so no framing
      // header and no CSP, as firebaseapp.com serves them. The proxied response
      // already carries Firebase's own headers; this only covers a response
      // Next.js makes itself here (no proxy configured).
      source: "/__/auth/:path+",
      headers: transport,
    },
    {
      source: "/w/:path*",
      headers: [{ key: "Content-Security-Policy", value: siteCsp(options) }],
    },
    {
      source: "/api/:path*",
      headers: [
        { key: "Content-Security-Policy", value: API_CSP },
        { key: "Cache-Control", value: "private, no-store" },
      ],
    },
    {
      // The owner's admin panel (pages and API): never indexed, never stored.
      // Pages are also force-dynamic, so Next's own Cache-Control is no-store.
      source: "/admin",
      headers: ADMIN_HEADERS,
    },
    { source: "/admin/:path*", headers: ADMIN_HEADERS },
    { source: "/api/admin/:path*", headers: ADMIN_HEADERS },
  ];
}

/** Added to every admin page and API response, including the proxy's not-found (src/proxy.ts). */
export const ADMIN_HEADERS = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Cache-Control", value: "private, no-store" },
];
