// HTTP endpoint for ZITADEL's HTTP e-mail provider: verify, render, send over SMTP.
// A non-2xx answer makes ZITADEL retry the notification.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import nodemailer from "nodemailer";
import { loadConfig, type Config } from "./config.ts";
import { parseNotification, PayloadError } from "./payload.ts";
import { render } from "./render.ts";
import { SIGNATURE_HEADER, verifySignature } from "./signature.ts";

const MAX_BODY = 256 * 1024;

export interface Sender {
  sendMail(mail: { from: string; to: string; subject: string; html: string; text: string }): Promise<unknown>;
}

function log(level: "info" | "warn" | "error", msg: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields }));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new PayloadError("body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function createHandler(cfg: Pick<Config, "signingKey" | "mailFrom" | "mailFromByOrg">, sender: Sender) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const reply = (status: number, body = "") => {
      res.writeHead(status, { "content-type": "text/plain" }).end(body);
    };
    if (req.method === "GET" && req.url === "/healthz") return reply(200, "ok");
    if (req.method !== "POST" || req.url !== "/") return reply(404);

    let body: string;
    try {
      body = await readBody(req);
    } catch {
      return reply(413);
    }
    const sig = req.headers[SIGNATURE_HEADER];
    if (!verifySignature(body, Array.isArray(sig) ? sig[0] : sig, cfg.signingKey)) {
      log("warn", "rejected: bad or missing signature");
      return reply(401);
    }

    let notification;
    try {
      notification = parseNotification(body);
    } catch (e) {
      log("warn", "rejected: invalid payload", { error: (e as Error).message });
      return reply(400);
    }

    const mail = render(notification);
    const from = (notification.orgId && cfg.mailFromByOrg[notification.orgId]) || cfg.mailFrom;
    try {
      await sender.sendMail({ from, to: notification.recipient, ...mail });
    } catch (e) {
      log("error", "smtp send failed", { eventType: notification.eventType, error: (e as Error).message });
      return reply(502);
    }
    log("info", "sent", { eventType: notification.eventType, orgId: notification.orgId });
    return reply(200);
  };
}

if (import.meta.main) {
  const cfg = loadConfig();
  const transport = nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.secure,
    requireTLS: !cfg.smtp.secure && cfg.smtp.requireTls,
    auth: cfg.smtp.user ? { user: cfg.smtp.user, pass: cfg.smtp.password ?? "" } : undefined,
    tls: cfg.smtp.ca ? { ca: cfg.smtp.ca } : undefined,
  });
  const handler = createHandler(cfg, transport);
  const server = createServer((req, res) => {
    handler(req, res).catch((e) => {
      log("error", "unhandled", { error: (e as Error).message });
      if (!res.headersSent) res.writeHead(500).end();
    });
  });
  server.listen(cfg.port, () => log("info", "listening", { port: cfg.port }));
  for (const s of ["SIGTERM", "SIGINT"] as const) process.on(s, () => server.close(() => process.exit(0)));
}
