// Pushes texts/<lang>.json to ZITADEL as instance-wide message texts.
//   ZITADEL_URL=https://sso.polyjapan.ch ZITADEL_PAT_FILE=pat.txt node scripts/sync-texts.ts [--apply]
// Without --apply it only lists what would change. Writing needs IAM_OWNER (or a role with iam.policy.write).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FIELDS = ["title", "preHeader", "subject", "greeting", "text", "buttonText", "footerText"] as const;

const base = process.env.ZITADEL_URL?.replace(/\/$/, "");
const patFile = process.env.ZITADEL_PAT_FILE;
if (!base || !patFile) {
  console.error("ZITADEL_URL and ZITADEL_PAT_FILE are required");
  process.exit(2);
}
const apply = process.argv.includes("--apply");
const headers = {
  authorization: `Bearer ${readFileSync(patFile, "utf8").trim()}`,
  "content-type": "application/json",
};
const dir = join(import.meta.dirname, "..", "texts");

let changes = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const lang = file.slice(0, -5);
  const types: Record<string, Record<string, string>> = JSON.parse(readFileSync(join(dir, file), "utf8"));
  for (const [type, wanted] of Object.entries(types)) {
    const url = `${base}/admin/v1/text/message/${type}/${lang}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GET ${type}/${lang}: ${res.status} ${await res.text()}`);
    const current = (await res.json()).customText ?? {};
    const diff = FIELDS.filter((f) => (current[f] ?? "") !== (wanted[f] ?? ""));
    if (diff.length === 0) continue;
    changes++;
    console.log(`${apply ? "update" : "would update"} ${type}/${lang}: ${diff.join(", ")}`);
    if (!apply) continue;
    const body = Object.fromEntries(FIELDS.map((f) => [f, wanted[f] ?? ""]));
    const put = await fetch(url, { method: "PUT", headers, body: JSON.stringify(body) });
    if (!put.ok) throw new Error(`PUT ${type}/${lang}: ${put.status} ${await put.text()}`);
  }
}
console.log(changes === 0 ? "up to date" : `${changes} message text(s) ${apply ? "updated" : "differ"}`);
