// Verifies the ZITADEL-Signature header sent by ZITADEL's HTTP e-mail provider.
// Format (pkg/actions/signing.go): "t=<unix seconds>,v1=<hex hmac-sha256(key, "<t>.<body>")>[,v1=...]".
import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "zitadel-signature";
const TOLERANCE_SECONDS = 300;

export function sign(body: string, key: string, unixSeconds: number): string {
  const mac = createHmac("sha256", key).update(`${unixSeconds}.${body}`).digest("hex");
  return `t=${unixSeconds},v1=${mac}`;
}

export function verifySignature(
  body: string,
  header: string | undefined,
  key: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  let timestamp: number | undefined;
  const signatures: Buffer[] = [];
  for (const pair of header.split(",")) {
    const [name, value, ...rest] = pair.split("=");
    if (value === undefined || rest.length > 0) return false;
    if (name === "t") timestamp = Number(value);
    else if (name === "v1" && /^[0-9a-f]+$/i.test(value)) signatures.push(Buffer.from(value, "hex"));
  }
  if (timestamp === undefined || !Number.isInteger(timestamp)) return false;
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", key).update(`${timestamp}.${body}`).digest();
  return signatures.some((s) => s.length === expected.length && timingSafeEqual(s, expected));
}
