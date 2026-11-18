"use server";

// PolyJapan: "receive a sign-in link by e-mail" from the password page. The link is ZITADEL's
// e-mail OTP: the /otp/email page requests the code and the mail carries a link back to it.
import { getSessionCookieByLoginName } from "@/lib/server/cookies";
import { getPublicHostWithProtocol } from "@/lib/server/host";
import { isMagicLinkOrganization, secondFactorsOf } from "@/lib/server/magic-link";
import { getServiceConfig } from "@/lib/server/service-url";
import { buildVerificationUrlTemplate } from "@/lib/server/verification-email";
import {
  addOTPEmail,
  getSession,
  getUserByID,
  listAuthenticationMethodTypes,
  sendEmailCode,
} from "@/lib/server/zitadel";
import { AuthenticationMethodType } from "@zitadel/proto/zitadel/user/v2/user_service_pb";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";

export async function sendMagicLink(command: { loginName: string; organization?: string; requestId?: string }) {
  const t = await getTranslations("password");
  const _headers = await headers();
  const { serviceConfig } = getServiceConfig(_headers);
  const unavailable = { error: t("magicLink.unavailable") };

  // the user is the one this browser identified on the login name page, never the caller's input
  const cookie = await getSessionCookieByLoginName({ loginName: command.loginName, organization: command.organization }).catch(
    () => undefined,
  );
  if (!cookie) {
    return unavailable;
  }
  const session = (await getSession({ serviceConfig, sessionId: cookie.id, sessionToken: cookie.token }).catch(() => undefined))
    ?.session;
  const userId = session?.factors?.user?.id;
  const organizationId = session?.factors?.user?.organizationId;
  if (!session || !userId || !isMagicLinkOrganization(organizationId)) {
    return unavailable;
  }

  const user = (await getUserByID({ serviceConfig, userId }))?.user;
  if (user?.type.case !== "human") {
    return unavailable;
  }

  const methods = (await listAuthenticationMethodTypes({ serviceConfig, userId })).authMethodTypes ?? [];
  // a TOTP, SMS or security key stays required: they sign in the usual way
  if (secondFactorsOf(methods, organizationId).length > 0) {
    return unavailable;
  }

  const params = new URLSearchParams({ loginName: command.loginName });
  if (command.organization) {
    params.set("organization", command.organization);
  }
  if (command.requestId) {
    params.set("requestId", command.requestId);
  }

  // ZITADEL only sends e-mail codes to a verified address: confirm it first (the first mail),
  // then the password page offers the link again (the second mail)
  if (!user.type.value.email?.isVerified) {
    const host = await getPublicHostWithProtocol(_headers);
    await sendEmailCode({
      serviceConfig,
      userId,
      urlTemplate: buildVerificationUrlTemplate(host, process.env.NEXT_PUBLIC_BASE_PATH ?? "", false, command.requestId),
    });
    params.set("userId", userId);
    return { redirect: `/verify?${params}` };
  }

  if (!methods.includes(AuthenticationMethodType.OTP_EMAIL)) {
    await addOTPEmail({ serviceConfig, userId });
  }

  params.set("sessionId", session.id);
  return { redirect: `/otp/email?${params}` };
}
