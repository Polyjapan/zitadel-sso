// HTML and plain-text rendering of one notification.
// Texts (subject, greeting, text, button, footer) come translated from ZITADEL's message texts;
// logo and colours come from the organisation's branding. This file only owns the layout.
import type { Notification } from "./payload.ts";

const DEFAULTS = {
  primaryColor: "#b43937",
  backgroundColor: "#fffaf4",
  fontColor: "#22292f",
};

// ponytail: fixed font stack, read fontFamily/fontUrl from the branding if an org ever uploads a font
const FONT = "Lato, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif";

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeUrl(u: string | undefined): string | undefined {
  if (!u) return undefined;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

function safeColor(c: string | undefined, fallback: string): string {
  return c && /^#[0-9a-f]{3,8}$/i.test(c) ? c : fallback;
}

function paragraphs(text: string, style: string): string {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="${style}">${escapeHtml(p).replaceAll("\n", "<br>")}</p>`)
    .join("\n");
}

function codeBlock(code: string, large: boolean, fontColor: string): string {
  const size = large ? "font-size:30px;letter-spacing:8px;" : "font-size:18px;letter-spacing:2px;";
  return `<tr><td align="center" style="padding:${large ? "8px 32px 24px" : "20px 32px 0"};"><div style="display:inline-block;padding:${large ? "16px 28px" : "12px 20px"};border-radius:8px;background:rgba(0,0,0,0.05);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;${size}font-weight:600;color:${fontColor};">${escapeHtml(code)}</div></td></tr>`;
}

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

export function render(n: Notification): RenderedMail {
  const d = n.data;
  const primary = safeColor(d.primaryColor, DEFAULTS.primaryColor);
  const background = safeColor(d.backgroundColor, DEFAULTS.backgroundColor);
  const fontColor = safeColor(d.fontColor, DEFAULTS.fontColor);
  const logo = safeUrl(d.logoUrl);
  const url = safeUrl(d.url);
  const button = url && d.buttonText ? d.buttonText : undefined;
  const footer = d.includeFooter !== false && d.footerText ? d.footerText : undefined;
  const code = n.code && /^[\w-]{1,64}$/.test(n.code) ? n.code : undefined;
  const textStyle = `margin:0 0 16px;font-size:16px;line-height:1.55;color:${fontColor};`;

  const html = `<!doctype html>
<html lang="und">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(d.title ?? d.subject ?? "")}</title>
</head>
<body style="margin:0;padding:0;background:#f3efe9;font-family:${FONT};">
${d.preHeader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(d.preHeader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3efe9;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${background};border-radius:12px;border:1px solid rgba(0,0,0,0.08);">
${logo ? `<tr><td align="center" style="padding:32px 32px 8px;"><img src="${escapeHtml(logo)}" width="140" alt="" style="display:block;width:140px;max-width:60%;height:auto;border:0;"></td></tr>` : ""}
<tr><td style="padding:24px 32px 8px;">
${d.greeting ? `<h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;font-weight:600;color:${fontColor};">${escapeHtml(d.greeting)}</h1>` : ""}
${d.text ? paragraphs(d.text, textStyle) : ""}
</td></tr>
${code && n.codeIsPrimary ? codeBlock(code, true, fontColor) : ""}
${
  button
    ? `<tr><td align="center" style="padding:8px 32px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${primary}" style="border-radius:8px;background:${primary};">
<a href="${escapeHtml(url!)}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(button)}</a>
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:8px 32px 0;"><a href="${escapeHtml(url!)}" style="font-size:12px;line-height:1.5;color:${fontColor};opacity:0.7;word-break:break-all;">${escapeHtml(url!)}</a></td></tr>`
    : ""
}
${code && !n.codeIsPrimary ? codeBlock(code, !button, fontColor) : ""}
<tr><td style="padding:32px 32px 32px;">${
    footer
      ? `<div style="border-top:1px solid rgba(0,0,0,0.1);padding-top:20px;font-size:13px;line-height:1.5;color:${fontColor};opacity:0.75;text-align:center;">${escapeHtml(footer).replaceAll("\n", "<br>")}</div>`
      : ""
  }</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;

  const text = [
    d.greeting,
    d.text,
    url ? `${button ? `${button}: ` : ""}${url}` : undefined,
    code,
    footer ? `--\n${footer}` : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject: d.subject ?? "", html, text: text + "\n" };
}
