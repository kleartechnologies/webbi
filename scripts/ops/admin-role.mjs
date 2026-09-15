// Grants or revokes the owner role for Webbi's admin panel (/admin).
//
//   node scripts/ops/admin-role.mjs status <uid>
//   node scripts/ops/admin-role.mjs grant <uid>            # dry run
//   node scripts/ops/admin-role.mjs grant <uid> --apply
//   node scripts/ops/admin-role.mjs revoke <uid> [--apply]
//
// The role is the Firebase Auth custom claim webbiRole: "owner". It is the only
// thing that makes an account the owner (src/lib/admin/auth.ts); there is no web
// endpoint that sets it. Granting refuses an account that is disabled, has no
// verified email or has no Google sign-in linked, because the panel refuses
// those anyway. Revoking removes the claim and revokes the account's sessions
// (validSince = now), so an open panel stops working on its next request.
//
// Other custom claims on the account are kept. Credentials:
// FIREBASE_SERVICE_ACCOUNT_BASE64, else Application Default Credentials
// (`gcloud auth application-default login`). With FIREBASE_AUTH_EMULATOR_HOST
// set it talks to the Auth emulator. No token, credential or claim JSON is printed.
import { applicationDefault, cert } from "firebase-admin/app";

const args = process.argv.slice(2).filter((arg) => arg !== "--apply");
const APPLY = process.argv.includes("--apply");
const [command, uid] = args;
const EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const ROLE = "owner";
const PROVIDER = "google.com";

function usage() {
  console.error("Usage: admin-role.mjs status <uid> | grant <uid> [--apply] | revoke <uid> [--apply]");
  process.exit(2);
}
if (!["status", "grant", "revoke"].includes(command) || !uid || args.length !== 2) usage();
if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) usage();

async function target() {
  if (EMULATOR) {
    const projectId = process.env.QA_PROJECT ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-webbi";
    return { projectId, origin: `http://${EMULATOR}/identitytoolkit.googleapis.com`, headers: { authorization: "Bearer owner" } };
  }
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (b64) {
    const account = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    const credential = cert({ projectId: account.project_id, clientEmail: account.client_email, privateKey: account.private_key });
    const { access_token } = await credential.getAccessToken();
    return { projectId: account.project_id, origin: "https://identitytoolkit.googleapis.com", headers: { authorization: `Bearer ${access_token}` } };
  }
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "webbi-85f26";
  const { access_token } = await applicationDefault().getAccessToken();
  return {
    projectId,
    origin: "https://identitytoolkit.googleapis.com",
    // User credentials need a quota project for Identity Toolkit.
    headers: { authorization: `Bearer ${access_token}`, "x-goog-user-project": projectId },
  };
}

const auth = await target().catch((error) => {
  console.error(`Failed: no credentials (${error instanceof Error ? error.name : typeof error}). See README → Admin panel.`);
  process.exit(1);
});

async function call(action, body) {
  const response = await fetch(`${auth.origin}/v1/projects/${auth.projectId}/accounts${action}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Firebase Auth answered ${response.status} to ${action}`);
  return response.json();
}

function claimsOf(user) {
  if (!user.customAttributes) return {};
  try {
    const claims = JSON.parse(user.customAttributes);
    return claims && typeof claims === "object" && !Array.isArray(claims) ? claims : {};
  } catch {
    return {};
  }
}

try {
  const { users = [] } = await call(":lookup", { localId: [uid] });
  const user = users.find((candidate) => candidate.localId === uid);
  console.log(`Project:   ${auth.projectId}${EMULATOR ? ` (Auth emulator ${EMULATOR})` : ""}`);
  if (!user) {
    console.error("Refused: no Firebase Auth account has that uid.");
    process.exit(1);
  }
  const claims = claimsOf(user);
  const providers = (user.providerUserInfo ?? []).map((info) => info.providerId).filter(Boolean);
  const isOwner = claims.webbiRole === ROLE;
  console.log(`Account:   ${uid}${user.email ? ` <${user.email}>` : ""}`);
  console.log(`Standing:  ${user.disabled ? "DISABLED" : "active"}, email ${user.emailVerified ? "verified" : "NOT verified"}, providers ${providers.join(", ") || "none"}`);
  console.log(`Role:      ${isOwner ? "OWNER (webbiRole: owner)" : "none"}`);

  if (command === "status") process.exit(0);

  if (command === "grant") {
    if (isOwner) {
      console.log("Already the owner. Nothing to do.");
      process.exit(0);
    }
    const problems = [
      user.disabled && "the account is disabled",
      user.emailVerified !== true && "the email isn't verified",
      !providers.includes(PROVIDER) && "Google sign-in isn't linked",
    ].filter(Boolean);
    if (problems.length) {
      console.error(`Refused: ${problems.join("; ")}. The admin panel requires an active, verified Google account.`);
      process.exit(1);
    }
    const next = JSON.stringify({ ...claims, webbiRole: ROLE });
    if (Buffer.byteLength(next) > 1000) throw new Error("the account's custom claims would exceed Firebase's 1000 byte limit");
    if (!APPLY) {
      console.log("Dry run: would grant webbiRole: owner. Re-run with --apply.");
      process.exit(0);
    }
    await call(":update", { localId: uid, customAttributes: next });
    console.log("Done: webbiRole: owner granted. Sign in to /admin on webbi.online with Google (sign out first if already signed in).");
    process.exit(0);
  }

  // revoke
  if (!isOwner) {
    console.log("Not the owner. Nothing to revoke.");
    process.exit(0);
  }
  if (!APPLY) {
    console.log("Dry run: would remove webbiRole and revoke this account's sessions. Re-run with --apply.");
    process.exit(0);
  }
  const rest = { ...claims };
  delete rest.webbiRole;
  await call(":update", {
    localId: uid,
    customAttributes: JSON.stringify(rest),
    validSince: String(Math.floor(Date.now() / 1000)),
  });
  console.log("Done: webbiRole removed and sessions revoked. The account must sign in again everywhere.");
  process.exit(0);
} catch (error) {
  console.error(`Failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
