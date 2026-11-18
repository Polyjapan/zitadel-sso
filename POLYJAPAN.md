# PolyJapan fork of ZITADEL

Fork of [zitadel/zitadel](https://github.com/zitadel/zitadel) used for the PolyJapan / Japan Impact SSO
(`sso.polyjapan.ch`, `sso.japan-impact.ch`).

The `polyjapan` branch is the upstream release tag running in production plus the commits below.
To upgrade, rebase `polyjapan` onto the new upstream tag.

## Changes (login app, `apps/login`)

- **Create-account button.** The "register" link under the login name field becomes a full-width
  secondary button below the form, with a "Don't have an account yet?" line (`loginname.noAccount`).
- **Unknown e-mail goes to registration.** When the login name is an e-mail with no matching user, and
  the organization allows registration and local authentication, the login redirects to `/register`
  with the e-mail prefilled, in the default organization if none was given. A login name that is not an
  e-mail still shows "user not found". `ignoreUnknownUsernames` still disables the redirect.

- **Language stored at registration.** Accounts created in the login get the login's language as
  their preferred language, so their e-mails arrive in it instead of the instance default.

Texts shown in the login (titles, button labels) are set at runtime through the API
(`SetHostedLoginTranslation`), not in this repository.

## E-mails (`polyjapan/mailer`)

A small service that receives ZITADEL's notifications through the HTTP e-mail provider, renders them
with our layout and sends them over SMTP. Texts are in `polyjapan/mailer/texts`. See
[its README](polyjapan/mailer/README.md).
