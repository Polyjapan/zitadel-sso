import { sendMagicLink } from "@/lib/actions/magic-link";
import { secondFactorsOf } from "@/lib/server/magic-link";
import { hasVerifiedPrimaryFactor } from "@/lib/server/session";
import { AuthenticationMethodType as M } from "@zitadel/proto/zitadel/user/v2/user_service_pb";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/zitadel", () => ({
  addOTPEmail: vi.fn(),
  getSession: vi.fn(),
  getUserByID: vi.fn(),
  listAuthenticationMethodTypes: vi.fn(),
  sendEmailCode: vi.fn(),
  getLoginSettings: vi.fn(),
}));
vi.mock("@/lib/server/cookies", () => ({
  getSessionCookieByLoginName: vi.fn(),
  getMostRecentCookieWithLoginname: vi.fn(),
  getSessionCookieById: vi.fn(),
}));
vi.mock("@/lib/server/service-url", () => ({ getServiceConfig: vi.fn(() => ({ serviceConfig: {} })) }));
vi.mock("@/lib/server/host", () => ({ getPublicHostWithProtocol: vi.fn(() => "https://sso.example.com") }));
vi.mock("next/headers", () => ({ headers: vi.fn(() => new Headers()) }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn(async () => (key: string) => key) }));

const MAGIC = "external-org";
const OTHER = "internal-org";
const verifiedAt = { seconds: BigInt(1), nanos: 0 };

describe("magic link factors", () => {
  beforeEach(() => vi.stubEnv("MAGIC_LINK_ORGANIZATIONS", `${MAGIC}, other`));

  test("the e-mail code is a primary factor only in magic link organisations", () => {
    const session = (org: string) => ({ factors: { user: { id: "u", organizationId: org }, otpEmail: { verifiedAt } } }) as any;
    expect(hasVerifiedPrimaryFactor(session(MAGIC)).valid).toBe(true);
    expect(hasVerifiedPrimaryFactor(session(OTHER)).valid).toBe(false);
  });

  test("the e-mail code is not a second factor there, the others still are", () => {
    expect(secondFactorsOf([M.PASSWORD, M.OTP_EMAIL], MAGIC)).toEqual([]);
    expect(secondFactorsOf([M.OTP_EMAIL, M.TOTP], MAGIC)).toEqual([M.TOTP]);
    expect(secondFactorsOf([M.OTP_EMAIL], OTHER)).toEqual([M.OTP_EMAIL]);
  });
});

describe("sendMagicLink", () => {
  let zitadel: any;
  let cookies: any;
  const user = (isVerified: boolean) => ({
    user: { userId: "u1", type: { case: "human", value: { email: { email: "a@example.com", isVerified } } } },
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv("MAGIC_LINK_ORGANIZATIONS", MAGIC);
    zitadel = vi.mocked(await import("@/lib/server/zitadel"));
    cookies = vi.mocked(await import("@/lib/server/cookies"));
    cookies.getSessionCookieByLoginName.mockResolvedValue({ id: "s1", token: "t1" });
    zitadel.getSession.mockResolvedValue({ session: { id: "s1", factors: { user: { id: "u1", organizationId: MAGIC } } } });
    zitadel.getUserByID.mockResolvedValue(user(true));
    zitadel.listAuthenticationMethodTypes.mockResolvedValue({ authMethodTypes: [M.PASSWORD] });
  });

  test("adds the e-mail factor and goes to the code page", async () => {
    const res = await sendMagicLink({ loginName: "a@example.com", requestId: "oidc_1" });

    expect(zitadel.addOTPEmail).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1" }));
    expect((res as any).redirect).toMatch(/^\/otp\/email\?/);
    expect((res as any).redirect).toContain("sessionId=s1");
    expect((res as any).redirect).toContain("requestId=oidc_1");
  });

  test("confirms an unverified address first", async () => {
    zitadel.getUserByID.mockResolvedValue(user(false));

    const res = await sendMagicLink({ loginName: "a@example.com" });

    expect(zitadel.sendEmailCode).toHaveBeenCalled();
    expect(zitadel.addOTPEmail).not.toHaveBeenCalled();
    expect((res as any).redirect).toMatch(/^\/verify\?.*userId=u1/);
  });

  test("is refused outside magic link organisations, without a session, or with another second factor", async () => {
    zitadel.getSession.mockResolvedValueOnce({ session: { id: "s1", factors: { user: { id: "u1", organizationId: OTHER } } } });
    expect(await sendMagicLink({ loginName: "a@example.com" })).toEqual({ error: "magicLink.unavailable" });

    cookies.getSessionCookieByLoginName.mockResolvedValueOnce(undefined);
    expect(await sendMagicLink({ loginName: "a@example.com" })).toEqual({ error: "magicLink.unavailable" });

    zitadel.listAuthenticationMethodTypes.mockResolvedValueOnce({ authMethodTypes: [M.PASSWORD, M.TOTP] });
    expect(await sendMagicLink({ loginName: "a@example.com" })).toEqual({ error: "magicLink.unavailable" });

    expect(zitadel.addOTPEmail).not.toHaveBeenCalled();
    expect(zitadel.sendEmailCode).not.toHaveBeenCalled();
  });
});
