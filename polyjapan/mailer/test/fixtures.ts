// A payload shaped like ZITADEL's HTTP e-mail provider body for a VerifyEmail notification.
export function verifyEmailPayload(overrides: Record<string, unknown> = {}) {
  return {
    contextInfo: {
      recipientEmailAddress: "jean@example.com",
      eventType: "user.human.email.code.added",
      provider: { id: "1", description: "mailer" },
    },
    templateData: {
      title: "PolyJapan - Vérifie ton e-mail",
      preHeader: "Vérifie ton e-mail",
      subject: "Vérifie ton adresse e-mail",
      greeting: "Salut Jean O&#39;Neil,",
      text: "Clique sur le bouton pour confirmer ton adresse.\n\nSi tu n&#39;as rien demandé, ignore ce message.",
      url: "https://sso.japan-impact.ch/ui/v2/login/verify?code=ABC123&userId=42",
      buttonText: "Confirmer",
      primaryColor: "#b43937",
      backgroundColor: "#fffaf4",
      fontColor: "#22292f",
      logoUrl: "https://sso.japan-impact.ch/assets/v1/1/policy/label/logo.png",
      fontFamily: "Lato, Arial, sans-serif",
      includeFooter: true,
      footerText: "Japan Impact · EPFL",
      ...overrides,
    },
    args: { code: "ABC123", orgID: "386967343617542147", displayName: "Jean O&#39;Neil", userID: "42" },
  };
}
