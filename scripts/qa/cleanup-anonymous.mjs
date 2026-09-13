// Removes the throwaway QA users (and their draft sites) that `qa:industries` /
// `qa:publish` / `qa:auth` leave behind in the REAL Firebase project.
//
//   node scripts/qa/cleanup-anonymous.mjs           # dry run: lists what would go
//   node scripts/qa/cleanup-anonymous.mjs --apply   # deletes it
//
// Needs `gcloud auth login` (uses your gcloud access token; nothing is stored).
// Only touches two kinds of Auth user: the legacy anonymous ones (no sign-in
// provider, no email) and the QA sign-ups the suites create now that building is
// account-first — qa-…@example.com, a domain RFC 2606 reserves so no customer can
// ever hold one. Plus their `sites` docs that are still drafts, their `users`
// docs, and orphaned `users` docs whose Auth user no longer exists (nobody can
// read those any more). Anyone who owns a non-draft site is skipped and reported.
import { execSync } from "node:child_process";

const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "webbi-85f26";
const APPLY = process.argv.includes("--apply");
const token = execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
const H = { Authorization: `Bearer ${token}`, "x-goog-user-project": PROJECT, "content-type": "application/json" };
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const AUTH = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts`;

async function json(url, init) {
  const r = await fetch(url, { headers: H, ...init });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${init?.method ?? "GET"} ${url} → ${r.status} ${JSON.stringify(body).slice(0, 200)}`);
  return body;
}
async function listCollection(col) {
  const docs = [];
  let pageToken;
  do {
    const r = await json(`${FS}/${col}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ""}`);
    docs.push(...(r.documents ?? []));
    pageToken = r.nextPageToken;
  } while (pageToken);
  return docs.map((d) => ({ path: d.name, id: d.name.split("/").pop(), fields: d.fields ?? {} }));
}
async function listUsers() {
  const users = [];
  let offset = 0;
  for (;;) {
    const r = await json(`${AUTH}:query`, { method: "POST", body: JSON.stringify({ returnUserInfo: true, limit: 500, offset }) });
    const page = r.userInfo ?? [];
    users.push(...page);
    if (page.length < 500) return users;
    offset += page.length;
  }
}

/** The addresses the QA suites sign up with; `example.com` is reserved, never a customer. */
const QA_EMAIL = /^qa-[^@]*@example\.com$/i;

const users = await listUsers();
const anonymous = users.filter((u) => (u.providerUserInfo ?? []).length === 0 && !u.email && !u.phoneNumber);
const qa = users.filter((u) => QA_EMAIL.test(u.email ?? ""));
const throwaway = [...anonymous, ...qa];
const throwawayIds = new Set(throwaway.map((u) => u.localId));
const sites = await listCollection("sites");
const userDocs = await listCollection("users");

// Never delete a user who owns something that is not a draft.
const keep = new Set(sites.filter((s) => throwawayIds.has(s.fields.ownerUid?.stringValue) && s.fields.status?.stringValue !== "draft").map((s) => s.fields.ownerUid.stringValue));
const usersToDelete = throwaway.filter((u) => !keep.has(u.localId));
const deleteIds = new Set(usersToDelete.map((u) => u.localId));
const sitesToDelete = sites.filter((s) => deleteIds.has(s.fields.ownerUid?.stringValue) && s.fields.status?.stringValue === "draft");
const existingIds = new Set(users.map((u) => u.localId));
const userDocsToDelete = userDocs.filter((d) => deleteIds.has(d.id) || !existingIds.has(d.id));

console.log(`Auth users: ${users.length} total, ${anonymous.length} anonymous, ${qa.length} qa-…@example.com, ${keep.size} owner(s) of non-draft sites kept`);
for (const uid of keep) console.log(`  keep ${uid} (owns a non-draft site)`);
console.log(`Would delete: ${usersToDelete.length} throwaway user(s), ${sitesToDelete.length} draft site doc(s), ${userDocsToDelete.length} users doc(s)`);
for (const s of sitesToDelete) console.log(`  sites/${s.id} owner=${s.fields.ownerUid.stringValue} "${(s.fields.sourceDescription?.stringValue ?? "").slice(0, 40)}"`);
for (const d of userDocsToDelete) console.log(`  users/${d.id}${existingIds.has(d.id) ? "" : " (orphan: no Auth user)"}`);

if (!APPLY) {
  console.log("Dry run only. Re-run with --apply to delete.");
  process.exit(0);
}

// Firestore first (rules are irrelevant here, but a user without docs is easier to reason about), 500 writes per commit.
const paths = [...sitesToDelete, ...userDocsToDelete].map((d) => d.path);
for (let i = 0; i < paths.length; i += 500) {
  await json(`${FS.replace(/\/documents$/, "")}/documents:commit`, { method: "POST", body: JSON.stringify({ writes: paths.slice(i, i + 500).map((p) => ({ delete: p })) }) });
}
console.log(`Deleted ${paths.length} Firestore doc(s)`);
const ids = [...deleteIds];
for (let i = 0; i < ids.length; i += 1000) {
  const r = await json(`${AUTH}:batchDelete`, { method: "POST", body: JSON.stringify({ localIds: ids.slice(i, i + 1000), force: true }) });
  for (const e of r.errors ?? []) console.log(`  failed ${ids[e.index]}: ${e.message}`);
}
console.log(`Deleted ${ids.length} Auth user(s)`);
