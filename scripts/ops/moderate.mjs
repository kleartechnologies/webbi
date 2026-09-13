// Takes an abusive website down, or restores it, in the Firebase project.
//
//   node scripts/ops/moderate.mjs status <siteId>
//   node scripts/ops/moderate.mjs suspend <siteId> "<reason>"          # dry run
//   node scripts/ops/moderate.mjs suspend <siteId> "<reason>" --apply
//   node scripts/ops/moderate.mjs unsuspend <siteId> [--apply]
//
// The writes are src/lib/site/moderationCore.ts itself (Node strips its types),
// in one transaction. Credentials: FIREBASE_SERVICE_ACCOUNT_BASE64, else
// Application Default Credentials (`gcloud auth application-default login`).
// With FIRESTORE_EMULATOR_HOST set it talks to the emulator. Nothing is stored,
// and no credential, owner or content is printed. See README → Moderation.
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { isSuspended, ModerationError, suspendSite, unsuspendSite } from "../../src/lib/site/moderationCore.ts";

const args = process.argv.slice(2).filter((arg) => arg !== "--apply");
const APPLY = process.argv.includes("--apply");
const [command, siteId, reason] = args;
const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;

function usage() {
  console.error('Usage: moderate.mjs status <siteId> | suspend <siteId> "<reason>" [--apply] | unsuspend <siteId> [--apply]');
  process.exit(2);
}
if (!["status", "suspend", "unsuspend"].includes(command) || !siteId) usage();
if (command === "suspend" && reason === undefined) usage();

function app() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (EMULATOR) return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-webbi" });
  if (b64) {
    const account = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    return initializeApp({
      credential: cert({ projectId: account.project_id, clientEmail: account.client_email, privateKey: account.private_key }),
      projectId: account.project_id,
    });
  }
  return initializeApp({ credential: applicationDefault(), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "webbi-85f26" });
}

const firebase = app();
const db = getFirestore(firebase);
const target = `${firebase.options.projectId}${EMULATOR ? ` (emulator ${EMULATOR})` : ""}`;

async function describe() {
  const snap = await db.doc(`sites/${siteId}`).get();
  if (!snap.exists) throw new ModerationError("not_found", "No such website.");
  const site = snap.data();
  const note = (await db.doc(`siteModeration/${siteId}`).get()).data();
  console.log(`Project:     ${target}`);
  console.log(`Website:     sites/${siteId}`);
  console.log(`Status:      ${site.status}${site.paid ? ", paid" : ""}${site.slug ? `, link /w/${site.slug}` : ""}`);
  console.log(`Moderation:  ${isSuspended(site) ? "SUSPENDED" : "active"}${note?.moderationReason ? ` (reason: ${note.moderationReason})` : ""}`);
  return site;
}

try {
  const site = await describe();
  if (command === "status") process.exit(0);
  if (command === "unsuspend" && !isSuspended(site)) {
    console.log("Already active. Nothing to do.");
    process.exit(0);
  }
  if (!APPLY) {
    console.log(`Dry run: would ${command} this website. Re-run with --apply.`);
    process.exit(0);
  }
  const now = () => FieldValue.serverTimestamp();
  const result = command === "suspend" ? await suspendSite(db, now, siteId, reason) : await unsuspendSite(db, now, siteId);
  console.log(`Done: ${result.moderationStatus}${result.changed ? "" : " (it already was)"}.`);
  for (const slug of result.slugs) console.log(`  /w/${slug} updated (the cached page refreshes within 60 seconds)`);
  if (command === "unsuspend") console.log("A payment held as site_suspended publishes when it is retried (the owner presses Pay again).");
  process.exit(0);
} catch (error) {
  console.error(error instanceof ModerationError ? `Refused: ${error.message}` : `Failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
