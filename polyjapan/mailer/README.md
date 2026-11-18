# zitadel-mailer

Sends ZITADEL's notification e-mails with our own layout. ZITADEL's HTML mail template is fixed at
instance creation and no API changes it afterwards, so ZITADEL is set to use an **HTTP e-mail
provider** pointing here: it posts each notification as signed JSON, this service renders it and
sends it over SMTP.

- **Layout**: `src/render.ts`, a single responsive table layout (logo, greeting, text, button,
  fallback link, code, footer) with a plain-text alternative.
- **Texts**: ZITADEL message texts, translated by ZITADEL in the user's language. Our versions live
  in `texts/<lang>.json` and are pushed with `scripts/sync-texts.ts`.
- **Branding**: logo and colours come from the organisation's label policy in ZITADEL.

## Run

Node 24 runs the TypeScript directly, no build step.

```sh
npm ci
npm test
SIGNING_KEY=... MAIL_FROM='SSO PolyJapan <noreply@polyjapan.ch>' SMTP_HOST=localhost npm start
```

| Variable | Default | |
|---|---|---|
| `SIGNING_KEY` | required | Key ZITADEL returns when the HTTP provider is created. Verifies `ZITADEL-Signature`. |
| `MAIL_FROM` | required | Sender, e.g. `SSO PolyJapan <noreply@polyjapan.ch>`. |
| `MAIL_FROM_BY_ORG` | `{}` | JSON map ZITADEL organisation id → sender, to sign Japan Impact mails differently. |
| `SMTP_HOST` | required | |
| `SMTP_PORT` | `587` | |
| `SMTP_SECURE` | `false` | `true` for TLS from the start (465). |
| `SMTP_REQUIRE_TLS` | `true` | Require STARTTLS when `SMTP_SECURE` is false. |
| `SMTP_USER`, `SMTP_PASSWORD` | none | |
| `SMTP_CA_PATH` | none | PEM bundle to trust, e.g. the internal CA of the postfix relay. |
| `PORT` | `8080` | |

`SIGNING_KEY`, `SMTP_PASSWORD` and the others also read from `<NAME>_FILE` (Docker secrets).

The service answers `200` once the SMTP server accepted the mail, `401` for a bad signature, `400` for an
unusable payload and `502` when SMTP fails, so that ZITADEL retries. `GET /healthz` answers `200`.

## Connect ZITADEL

1. Start the mailer where ZITADEL can reach it. **ZITADEL refuses private addresses by default**
   (`HTTPClient.DenyList` holds 10/8, 172.16/12, 192.168/16…): either give the mailer a public HTTPS
   address, or narrow `ZITADEL_HTTPCLIENT_DENYLIST` so the mailer's network is allowed.
2. Create the provider, and keep the `signingKey` of the answer (it is shown once):
   `POST /admin/v1/email/http` with `{"endpoint": "https://…/", "description": "zitadel-mailer"}`.
3. Give that key to the mailer as `SIGNING_KEY` and start it.
4. Activate the provider: `POST /admin/v1/email/<id>/_activate`. This deactivates the SMTP provider;
   activating the SMTP provider again rolls back.

## Texts

```sh
ZITADEL_URL=https://sso.polyjapan.ch ZITADEL_PAT_FILE=pat.txt npm run sync-texts            # what would change
ZITADEL_URL=https://sso.polyjapan.ch ZITADEL_PAT_FILE=pat.txt npm run sync-texts -- --apply # write
```

Texts are set instance-wide, so they stay neutral between PolyJapan and Japan Impact. Writing needs
a token allowed to change instance message texts. `{{.FirstName}}`, `{{.PreferredLoginName}}` and
the other ZITADEL variables are filled by ZITADEL.
