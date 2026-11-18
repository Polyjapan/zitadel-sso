import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import { parseNotification, PayloadError } from "../src/payload.ts";
import { contrastText, render } from "../src/render.ts";
import { createHandler } from "../src/server.ts";
import { sign, verifySignature } from "../src/signature.ts";
import { verifyEmailPayload } from "./fixtures.ts";

const KEY = "test-signing-key";

describe("signature", () => {
  const body = '{"a":1}';
  const now = 1_800_000_000;

  test("accepts a valid signature", () => {
    assert.ok(verifySignature(body, sign(body, KEY, now), KEY, now));
  });
  test("accepts any of several v1 signatures (key rotation)", () => {
    const header = `${sign(body, "old-key", now)},v1=${sign(body, KEY, now).split("v1=")[1]}`;
    assert.ok(verifySignature(body, header, KEY, now));
  });
  test("rejects a wrong key, a modified body, a stale timestamp, a missing header", () => {
    assert.equal(verifySignature(body, sign(body, "other", now), KEY, now), false);
    assert.equal(verifySignature('{"a":2}', sign(body, KEY, now), KEY, now), false);
    assert.equal(verifySignature(body, sign(body, KEY, now - 301), KEY, now), false);
    assert.equal(verifySignature(body, undefined, KEY, now), false);
    assert.equal(verifySignature(body, "garbage", KEY, now), false);
  });
});

describe("payload", () => {
  test("decodes the entities ZITADEL adds and picks recipient, org and code", () => {
    const n = parseNotification(JSON.stringify(verifyEmailPayload()));
    assert.equal(n.recipient, "jean@example.com");
    assert.equal(n.orgId, "386967343617542147");
    assert.equal(n.code, "ABC123");
    assert.equal(n.data.greeting, "Salut Jean O'Neil,");
  });
  test("prefers the OTP for e-mail OTP notifications", () => {
    const p = verifyEmailPayload();
    (p.args as any).oTP = "123456";
    assert.equal(parseNotification(JSON.stringify(p)).code, "123456");
  });
  test("rejects bodies without recipient or subject", () => {
    assert.throws(() => parseNotification("nope"), PayloadError);
    const p = verifyEmailPayload();
    p.contextInfo.recipientEmailAddress = "";
    assert.throws(() => parseNotification(JSON.stringify(p)), PayloadError);
    assert.throws(() => parseNotification(JSON.stringify(verifyEmailPayload({ subject: "" }))), PayloadError);
  });
});

describe("render", () => {
  test("renders texts, button, fallback link, code, logo and footer", () => {
    const m = render(parseNotification(JSON.stringify(verifyEmailPayload())));
    assert.equal(m.subject, "Vérifie ton adresse e-mail");
    assert.match(m.html, /Salut Jean O&#39;Neil,/);
    assert.match(m.html, /<p [^>]*>Clique sur le bouton pour confirmer ton adresse.<\/p>/);
    assert.match(m.html, />Confirmer<\/a>/);
    assert.match(m.html, /href="https:\/\/sso.japan-impact.ch\/ui\/v2\/login\/verify\?code=ABC123&amp;userId=42"/);
    assert.match(m.html, />ABC123<\/div>/);
    assert.match(m.html, /<img src="https:\/\/sso.japan-impact.ch\/assets/);
    assert.match(m.html, /Japan Impact · EPFL/);
    assert.match(m.text, /Confirmer: https:\/\/sso.japan-impact.ch/);
  });
  test("escapes HTML coming from texts", () => {
    const m = render(parseNotification(JSON.stringify(verifyEmailPayload({ greeting: "<script>alert(1)</script>" }))));
    assert.doesNotMatch(m.html, /<script>/);
    assert.match(m.html, /&lt;script&gt;/);
  });
  test("drops non-http links, odd colours and unsafe fonts", () => {
    const m = render(
      parseNotification(
        JSON.stringify(
          verifyEmailPayload({
            url: "javascript:alert(1)",
            logoUrl: "data:image/png;base64,xx",
            primaryColor: "red;background:url(x)",
            fontFamily: "x;}</style><script>",
          }),
        ),
      ),
    );
    assert.doesNotMatch(m.html, /javascript:/);
    assert.doesNotMatch(m.html, /data:image/);
    assert.doesNotMatch(m.html, /<script>/);
    assert.doesNotMatch(m.html, />Confirmer</);
    assert.doesNotMatch(m.html, /url\(x\)/);
  });
  test("falls back to the default colour when the branding colour is not a hex value", () => {
    const m = render(parseNotification(JSON.stringify(verifyEmailPayload({ primaryColor: "red;background:url(x)" }))));
    assert.match(m.html, /background:#b43937/);
    assert.doesNotMatch(m.html, /url\(x\)/);
  });
  test("leaves the footer out when ZITADEL says so", () => {
    const m = render(parseNotification(JSON.stringify(verifyEmailPayload({ includeFooter: false }))));
    assert.doesNotMatch(m.html, /Japan Impact · EPFL/);
  });
  test("picks readable button text", () => {
    assert.equal(contrastText("#b43937"), "#ffffff");
    assert.equal(contrastText("#f8d295"), "#1a1a1a");
    assert.equal(contrastText("#fff"), "#1a1a1a");
  });
});

describe("handler", () => {
  async function withServer(sender: any, fn: (url: string) => Promise<void>) {
    const handler = createHandler(
      { signingKey: KEY, mailFrom: "SSO <noreply@polyjapan.ch>", mailFromByOrg: { "386967343617542147": "Japan Impact <noreply@polyjapan.ch>" } },
      sender,
    );
    const server = createServer((req, res) => void handler(req, res));
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    try {
      await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    } finally {
      server.close();
    }
  }
  const post = (url: string, body: string, headers: Record<string, string> = {}) =>
    fetch(url + "/", { method: "POST", body, headers: { "content-type": "application/json", ...headers } });

  test("sends a signed notification with the organisation's sender", async () => {
    const sent: any[] = [];
    await withServer({ sendMail: async (m: any) => sent.push(m) }, async (url) => {
      const body = JSON.stringify(verifyEmailPayload());
      const res = await post(url, body, { "ZITADEL-Signature": sign(body, KEY, Math.floor(Date.now() / 1000)) });
      assert.equal(res.status, 200);
    });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "jean@example.com");
    assert.equal(sent[0].from, "Japan Impact <noreply@polyjapan.ch>");
    assert.equal(sent[0].subject, "Vérifie ton adresse e-mail");
  });
  test("answers 401 unsigned, 400 invalid, 502 on SMTP failure so ZITADEL retries", async () => {
    await withServer({ sendMail: async () => { throw new Error("smtp down"); } }, async (url) => {
      const body = JSON.stringify(verifyEmailPayload());
      const now = Math.floor(Date.now() / 1000);
      assert.equal((await post(url, body)).status, 401);
      assert.equal((await post(url, "{}", { "ZITADEL-Signature": sign("{}", KEY, now) })).status, 400);
      assert.equal((await post(url, body, { "ZITADEL-Signature": sign(body, KEY, now) })).status, 502);
      assert.equal((await fetch(url + "/healthz")).status, 200);
    });
  });
});
