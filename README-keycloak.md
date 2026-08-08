# Keycloak and APISIX Integration

The "docker-compose.services.yml" file includes Keycloak and APISIX containers
that you can use for authentication instead of spinning up separate ones or
using the deployed instances. It's not enabled by default, but you can run it if
you prefer not to run your own Keycloak/APISIX instances.

## Default Settings

There are some defaults that are part of this.

_SSL Certificate_: There's a self-signed cert that's in `config/keycloak/tls` -
if you'd rather set up your own (or you have a real cert or something to use),
you can drop the PEM files in there. See the README there for info.

_Realm_: There's a `ol-local-realm.json` in `config/keycloak` that will get
loaded by Keycloak when it starts up, and will set up a realm for you with some
users and a client so you don't have to set it up yourself. The realm it creates
is called `ol-local`.

The users it sets up are:

| User                | Password  |
| ------------------- | --------- |
| `student@odl.local` | `student` |
| `prof@odl.local`    | `prof`    |
| `admin@odl.local`   | `admin`   |

The client it sets up is called `apisix`. You can change the passwords and get
the secret in the admin.

## Making it Work

The Keycloak instance is part of the `keycloak` profile in the Composer file, so
be sure that you have the following set in your .env file:
`COMPOSE_PROFILES=backend,frontend,keycloak,apisix`. (If you
start the app without the profile, you can still start Keycloak later by
specifying the profile.)

When you run `docker compose up`, the Keycloak and APISIX containers should start up.
APISIX is on port 8065, Keycloak on port 8066. Now you should be able to log in at
`https://open.odl.local:8065/login` with one of the users mentioned above, or
just click "Log in" from the home page at http://open.odl.local:8062. Try
logging out and back in a couple times to make sure it works.

Keycloak is enabled by default. If you do NOT want to use the Keycloak and APISIX instances,
follow these steps:

1. Change the value of `MITOL_API_BASE_URL` to `http://api.open.odl.local:8063`
   in your `shared.local.env` file.
2. Add `DISABLE_APISIX_USER_MIDDLEWARE=True` to your `backend.local.env` file
3. Set `COMPOSE_PROFILES=backend,frontend` in your .env file

### Changing email and password

The settings page at `/dashboard/settings` lets users change their email and
password by handing off to Keycloak ("application initiated actions"). Two
things have to be in place for `kc_action=UPDATE_EMAIL` to work:

1. Keycloak must be started with the `update-email` feature. `UPDATE_EMAIL` is
   still a preview feature, so it is listed explicitly in the `keycloak`
   service's `--features` flag in `docker-compose.services.yml`.
2. The `UPDATE_EMAIL` required action must be registered in the realm. It is in
   `config/keycloak/realms/ol-local-realm.json`, but `--import-realm` skips
   realms that already exist in the database. If you set Keycloak up before this
   was added, register it once via Keycloak admin
   (Authentication → Required actions → Register → Update Email), or reset the
   Keycloak database so the realm re-imports.

Without both, Keycloak fails the request with a generic "Unexpected error when
handling authentication request to identity provider" page, and its logs show
`NullPointerException ... "requiredActionProvider" is null`.

`UPDATE_PASSWORD` is a built-in action and needs neither step.

#### Email, and why it matters for changing your email

Deployed realms have `verify_email` enabled, which changes the flow materially:
submitting the "Update your email" form does **not** change the address. Keycloak
emails a confirmation link to the new address and only applies the change once
that link is clicked. Testing against a local realm with verification off will
give you a different flow than production.

The `keycloak` profile therefore includes **Mailpit**, which captures every email
Keycloak sends. Nothing leaves your machine, so any address works.

- Inbox: http://localhost:8025
- The realm export points Keycloak's SMTP at `mailpit:1025` and sets
  `verifyEmail: true`, matching the deployed realms.

`--import-realm` skips realms that already exist, so an existing local setup
needs this applied once by hand — Keycloak admin → _Realm settings → Email_
(host `mailpit`, port `1025`, from `no-reply@open.odl.local`, no auth/SSL/TLS),
and _Realm settings → Login → Verify email_ on.

One gotcha when using the **Test connection** button: Keycloak sends the test to
the _logged-in admin user's own_ address, so it returns a 500 with only
`Failed to send email` in the logs if that user has no email set. Set one on the
`admin` user in the `master` realm first.

#### The MIT Learn login theme

Out of the box, local Keycloak serves the stock Keycloak login pages, so the
change-email and change-password forms look nothing like the deployed ones. The
branded theme is `ol-learn`, built from
[ol-keycloakify](https://github.com/mitodl/ol-keycloakify) and shipped as a
provider jar inside the `mitodl/keycloak` image that deployed environments run.

To get it locally:

```bash
./scripts/fetch_keycloak_theme.sh
docker compose restart keycloak
```

That lifts the theme jar out of `mitodl/keycloak` into
`config/keycloak/providers/` (gitignored), where Keycloak loads it. The realm
export sets `loginTheme`/`emailTheme`/`accountTheme` to `ol-learn`; if your realm
predates that, set it once under Realm settings → Themes, since `--import-realm`
skips realms that already exist.

The jar is copied rather than running `mitodl/keycloak` locally on purpose: that
image tracks a newer Keycloak than docker-compose pins, and Keycloak database
migrations are one-way, so starting it against an existing local realm database
cannot be undone.

Keycloak re-runs its build on the first start after a provider is added, so that
start takes noticeably longer than usual.

### MITx Online integration

The user dashboard at `/dashboard` includes some integration with the MITx Online
application (https://github.com/mitodl/mitxonline). In order for the same session to
be shared between the two applications, they need to both be accessed through the same
instance of APISIX. The dev APISIX configuration (`config/apisix/apisix.yaml`) includes
two routes:

- MITx Online frontend: Set by `MITX_ONLINE_DOMAIN`, defaulting to `mitxonline.odl.local`, accessed through http://mitxonline.odl.local:8065/
- Path prefixed API: Set by `MITOL_API_DOMAIN`, defaulting to `open.odl.local`, accessed through http://open.odl.local:8065/mitxonline/

For local development you will need to configure some local DNS entries in your hosts file,
pointing them at your local IP address. This is necessary so that the APISIX container can
reach out to both the Learn Django server as well as the MITx Online Django server as upstreams.

Here is an example of what the `hosts` entries might look like, assuming a local IP of 192.168.1.50:

```
192.168.1.50 open.odl.local
192.168.1.50 api.open.odl.local
192.168.1.50 kc.ol.local
192.168.1.50 mitxonline.odl.local
```

In your MITx Online application, you will also need to set all the `KEYCLOAK_` prefixed env vars
to be the same as they are here in MIT Learn. You will also need to set `CORS_ALLOWED_ORIGINS`,
`CSRF_TRUSTED_ORIGINS`, `ALLOWED_REDIRECT_HOSTS` and `SOCIAL_AUTH_ALLOWED_REDIRECT_HOSTS` in both
apps to allow them to communicate with one another.
