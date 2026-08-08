# Rollout runbook: change email / change password

Ordered steps to ship self-service email and password changes, across three pull
requests, a management command, and one piece of Keycloak configuration.

| PR                                                                              | Repo              | What it does                               |
| ------------------------------------------------------------------------------- | ----------------- | ------------------------------------------ |
| [mit-learn#3726](https://github.com/mitodl/mit-learn/pull/3726)                 | mit-learn         | the feature itself                         |
| [ol-infrastructure#5252](https://github.com/mitodl/ol-infrastructure/pull/5252) | ol-infrastructure | Keycloak service account for the Admin API |
| [ol-infrastructure#5292](https://github.com/mitodl/ol-infrastructure/pull/5292) | ol-infrastructure | app settings that consume it               |

After step 1 the feature works for normal users. Track A hides it from SSO users;
track B makes a confirmed address reach Learn immediately instead of on next
login. The tracks are independent — either can ship without the other.

## Before you start

- **#5292's base branch must be `ahtesham/mitlearn-keycloak-account-actions`, not
  `main`.** With `main` it duplicates #5252's commit and can merge first, which is
  what the split exists to prevent.
- Both infrastructure PRs still need their descriptions filled in.

---

## Step 1 — Merge mit-learn#3726

Merge with the `account-management` PostHog flag **off** (or not yet created).

Safe on its own: the flag gates the UI, `KEYCLOAK_CLIENT_ID` is unset so the
account-action endpoint returns an error alert rather than a 500, and the SSO check
fails open.

This also ships two things later steps depend on: the `ApisixUserMiddleware` change
that stops a stale gateway header overwriting the email, and the
`provision_scim_client` command.

---

## Track A — hide the section from SSO users

### Step 2 — Merge #5252, apply `ol-substructure-keycloak`

Per environment, CI → QA → Production. Creates the `mitlearn-admin-client` service
account, grants it `view-users` / `query-users` / `manage-users`, and writes its
credentials to Vault.

### Step 3 — Gate: confirm the Vault path exists

```bash
vault kv get secret-operations/sso/mitlearn/admin
```

Expect `client_id`, `client_secret`, `realm_name`, `url`.

**If this 404s, stop.** Step 4 creates a Kubernetes secret that reads this path,
and `env_from_secret_names` attaches secrets without `optional: true` — so a
missing secret means new pods fail with `CreateContainerConfigError` and the
rollout stalls. Existing pods keep serving, so it is not an outage, but the deploy
will not proceed.

### Step 4 — Merge #5292, apply `applications/mit_learn`

**Same environment as step 2.** Adds `MITOL_KEYCLOAK_ADMIN_CLIENT_*` plus
`KEYCLOAK_CLIENT_ID` / `KEYCLOAK_CLIENT_SECRET`; pods restart.

Verify: the Email & Password section disappears for a user who signs in through an
external IdP, and Keycloak logs a federated-identity read.

This also activates `profiles.api.sync_email_optin_to_keycloak`, which has never
run in any deployed environment — so the "Receive emails from MIT Learn" preference
starts reaching Keycloak.

---

## Track B — make a confirmed address reach Learn immediately

Without this, a user who confirms a new address via the emailed link sees it
applied in Keycloak while Learn keeps the old one until their next login. Nothing
reports incorrectly; it is a timing gap. Background: `docs/keycloak-scim-request.md`.

### Step 5 — Provision the credentials Keycloak will use

Once per environment, after #3726 is deployed there:

```bash
python manage.py provision_scim_client
```

Creates a staff service user (`scim-keycloak`), an OAuth2 application, and a bearer
token bound to that user. Idempotent — re-running leaves an existing token alone.

**What the token is for:** exactly one thing — Keycloak sends it as the
`Authorization: Bearer …` header when pushing user changes to Learn's
`/scim/v2/` endpoints. Nothing else uses it, and it grants nothing beyond what that
staff service user can do.

**If you lose it,** read it back rather than rotating:

```python
AccessToken.objects.get(user__username="scim-keycloak").token
```

`AccessToken.token` is stored unhashed (unlike `Application.client_secret`). Use
`--rotate-token` only when you actually want to invalidate the old one — that
breaks any Keycloak config still holding it.

### Step 6 — Keycloak owner adds Learn as a SCIM target

Send them `docs/keycloak-scim-request.md`. In the `olapps` realm's
scim-for-keycloak admin backend, add a `RemoteScimProviderConfig`:

| Field      | Value                                                                     |
| ---------- | ------------------------------------------------------------------------- |
| Base URL   | `https://api.rc.learn.mit.edu/scim/v2/` (production: `api.learn.mit.edu`) |
| Auth type  | **BEARER**, with the token from step 5                                    |
| Resource   | Users                                                                     |
| Operations | update (minimum)                                                          |

**Not `CLIENT_CREDENTIALS_GRANT`.** Those tokens belong to the application rather
than a user, so `AccessToken.user` is null and Learn's
`is_authenticated_predicate` — which requires active staff — rejects the push with
a 401.

### Step 7 — Verify the push in isolation

Change a test user's email **directly in Keycloak admin**, bypassing the
account-action flow, and confirm Learn's `User.email` updates within seconds. This
separates "is the push configured" from "is the flow working". Then run the full
flow and confirm Learn is correct without re-logging in.

---

## Step 8 — Enable the feature

Create the `account-management` flag in PostHog. Enable it for yourself in RC,
walk the flow end to end, then roll out.

---

## Ordering rules

- **2 → 3 → 4 is strict.** See step 3.
- **Same-environment pairs.** Applying #5252 in Production and #5292 in QA leaves
  QA reading a Vault path that does not exist there.
- **5 before 6** — Keycloak needs the token.
- **1 before 5** — before #3726, the middleware re-applies the gateway header's
  email on every request and would undo any SCIM-delivered value within one
  request.
- **Rollback is the reverse:** #5292 before #5252. Reverting #5252 deletes the
  Keycloak client while pods may still hold its credentials; the SSO check then
  fails open, so the buttons reappear for SSO users rather than erroring.

## Things that cannot be verified before RC

- **SSO hiding** needs `MITOL_KEYCLOAK_ADMIN_CLIENT_*`, so locally `is_sso_user()`
  returns `False` and the section always shows.
- **The Keycloak SCIM push.** Learn's receiving side _is_ testable locally (see
  `docs/keycloak-scim-request.md`), but the plugin is enterprise-licensed and absent
  from the upstream Keycloak image local development runs.
- **Whether changing an email ends the Keycloak session.** It appears to — a
  `prompt=none` re-authorization after confirming returns `login_required` rather
  than a code. If that holds, the user logs back in and the new address syncs
  immediately, which makes the track B gap largely theoretical. Worth confirming in
  RC.
