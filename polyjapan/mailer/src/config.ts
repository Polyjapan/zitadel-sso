// Configuration from the environment. Every secret also reads from <NAME>_FILE (Docker secrets).
import { readFileSync } from "node:fs";

function env(name: string): string | undefined {
  const file = process.env[`${name}_FILE`];
  if (file) return readFileSync(file, "utf8").trim();
  const v = process.env[name];
  return v === "" ? undefined : v;
}

function required(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`${name} (or ${name}_FILE) is required`);
  return v;
}

export interface Config {
  port: number;
  signingKey: string;
  mailFrom: string;
  /** Sender per ZITADEL organisation id, overriding mailFrom. */
  mailFromByOrg: Record<string, string>;
  smtp: {
    host: string;
    port: number;
    /** true: TLS from the start (465). false: STARTTLS when offered, required when requireTls. */
    secure: boolean;
    requireTls: boolean;
    user?: string;
    password?: string;
    ca?: string;
  };
}

export function loadConfig(): Config {
  const caFile = env("SMTP_CA_PATH");
  return {
    port: Number(env("PORT") ?? 8080),
    signingKey: required("SIGNING_KEY"),
    mailFrom: required("MAIL_FROM"),
    mailFromByOrg: JSON.parse(env("MAIL_FROM_BY_ORG") ?? "{}"),
    smtp: {
      host: required("SMTP_HOST"),
      port: Number(env("SMTP_PORT") ?? 587),
      secure: env("SMTP_SECURE") === "true",
      requireTls: env("SMTP_REQUIRE_TLS") !== "false",
      user: env("SMTP_USER"),
      password: env("SMTP_PASSWORD"),
      ca: caFile ? readFileSync(caFile, "utf8") : undefined,
    },
  };
}
