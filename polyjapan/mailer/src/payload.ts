// Shape of the JSON body ZITADEL posts to an HTTP e-mail provider
// (internal/notification/types/user_email.go, serializableData).
// ZITADEL HTML-escapes argument strings before translating, so texts arrive with entities
// such as &#39; and are decoded here once; rendering escapes them again.

export interface TemplateData {
  title?: string;
  preHeader?: string;
  subject?: string;
  greeting?: string;
  text?: string;
  url?: string;
  buttonText?: string;
  primaryColor?: string;
  backgroundColor?: string;
  fontColor?: string;
  logoUrl?: string;
  fontUrl?: string;
  fontFaceFamily?: string;
  fontFamily?: string;
  includeFooter?: boolean;
  footerText?: string;
}

export interface Notification {
  recipient: string;
  eventType: string;
  orgId?: string;
  data: TemplateData;
  /** One-time code shown in the mail (OTP for e-mail OTP, otherwise the verification code). */
  code?: string;
  /** The code is what the mail is for (e-mail OTP), not a fallback for the button. */
  codeIsPrimary?: boolean;
}

const ENTITIES: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&#34;": '"', "&#39;": "'", "&quot;": '"', "&amp;": "&" };

export function decodeEntities(s: string): string {
  return s.replace(/&(lt|gt|#34|#39|quot|amp);/g, (m) => ENTITIES[m]);
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? decodeEntities(v) : undefined;
}

export class PayloadError extends Error {}

export function parseNotification(body: string): Notification {
  let raw: any;
  try {
    raw = JSON.parse(body);
  } catch {
    throw new PayloadError("body is not JSON");
  }
  const recipient = str(raw?.contextInfo?.recipientEmailAddress);
  if (!recipient || !/^[^\s@]+@[^\s@]+$/.test(recipient)) throw new PayloadError("missing recipientEmailAddress");

  const td = raw?.templateData ?? {};
  const data: TemplateData = {};
  for (const [k, v] of Object.entries(td)) {
    if (typeof v === "string") (data as any)[k] = decodeEntities(v);
    else if (typeof v === "boolean") (data as any)[k] = v;
  }
  if (!data.subject) throw new PayloadError("missing subject");

  const args = raw?.args ?? {};
  return {
    recipient,
    eventType: str(raw?.contextInfo?.eventType) ?? "",
    orgId: str(args.orgID),
    data,
    code: str(args.oTP) ?? str(args.otp) ?? str(args.code),
    codeIsPrimary: Boolean(str(args.oTP) ?? str(args.otp)),
  };
}
