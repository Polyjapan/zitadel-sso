// Renders every message text in texts/ with sample data into <out>/<lang>-<type>.html, for review.
//   node scripts/preview.ts /tmp/mail-preview [jpi|pj]
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "../src/render.ts";

const out = process.argv[2] ?? "preview";
const brand = process.argv[3] ?? "jpi";
mkdirSync(out, { recursive: true });

// Branding of the production organisations (label policies) on 2026-11-18.
const BRANDS = {
  jpi: {
    primaryColor: "#b43937",
    backgroundColor: "#fffaf4",
    fontColor: "#b43937",
    logoUrl: "https://sso.polyjapan.ch/assets/v1/386967343617542147/policy/label/logo-387973524062472195",
  },
  pj: {
    primaryColor: "#b43937",
    backgroundColor: "#fffaf4",
    fontColor: "#b43937",
    logoUrl: "https://sso.polyjapan.ch/assets/v1/386244647808141430/policy/label/logo-386380300675975286",
  },
} as const;

const sample: Record<string, string> = {
  FirstName: "Jean",
  DisplayName: "Jean Dupont",
  PreferredLoginName: "jean.dupont@example.com",
  Username: "jean.dupont@example.com",
  TempUsername: "jean.dupont-1234",
  Domain: "example.com",
  ApplicationName: "Japan Impact Staff",
};
const fill = (s: string) => s.replace(/\{\{\s*\.(\w+)\s*\}\}/g, (_, k) => sample[k] ?? `{{.${k}}}`);

const dir = join(import.meta.dirname, "..", "texts");
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const lang = file.slice(0, -5);
  const types: Record<string, Record<string, string>> = JSON.parse(readFileSync(join(dir, file), "utf8"));
  for (const [type, t] of Object.entries(types)) {
    const mail = render({
      recipient: "jean.dupont@example.com",
      eventType: type,
      data: {
        ...Object.fromEntries(Object.entries(t).map(([k, v]) => [k, fill(v)])),
        url: "https://sso.japan-impact.ch/ui/v2/login/verify?userId=400012398242564258&code=K7Q2PX",
        includeFooter: true,
        ...BRANDS[brand as keyof typeof BRANDS],
      },
      code: type === "verifyemailotp" ? "482913" : ["init", "verifyemail", "passwordreset"].includes(type) ? "K7Q2PX" : undefined,
      codeIsPrimary: type === "verifyemailotp",
    });
    writeFileSync(join(out, `${lang}-${type}.html`), mail.html);
  }
}
console.log(`written to ${out}`);
