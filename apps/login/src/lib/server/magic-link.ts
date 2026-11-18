import "server-only";

import { AuthenticationMethodType } from "@zitadel/proto/zitadel/user/v2/user_service_pb";

/**
 * PolyJapan: organisations where a code sent by e-mail is enough to sign in ("magic link").
 * MAGIC_LINK_ORGANIZATIONS holds their ids, comma separated. In them, the e-mail code is a primary
 * factor, and no longer a second factor after a password: holding the mailbox already signs in.
 */
export function isMagicLinkOrganization(organizationId?: string): boolean {
  if (!organizationId) {
    return false;
  }
  return (process.env.MAGIC_LINK_ORGANIZATIONS ?? "")
    .split(",")
    .map((id) => id.trim())
    .includes(organizationId);
}

/** Second factors that still apply: in magic link organisations the e-mail code is not one. */
export function secondFactorsOf(methods: AuthenticationMethodType[] | undefined, organizationId?: string) {
  const magicLink = isMagicLinkOrganization(organizationId);
  return (methods ?? []).filter(
    (m) =>
      m === AuthenticationMethodType.TOTP ||
      m === AuthenticationMethodType.OTP_SMS ||
      m === AuthenticationMethodType.U2F ||
      (m === AuthenticationMethodType.OTP_EMAIL && !magicLink),
  );
}
