# Request: push user changes from Keycloak to MIT Learn over SCIM

**Ask:** configure a Remote SCIM provider target in the `olapps` realm's
scim-for-keycloak plugin so user attribute changes are pushed to MIT Learn, as
they already are for MITx Online.

**Who this needs:** whoever administers `sso.ol.mit.edu` (the scim-for-keycloak
enterprise plugin's admin backend is not managed in `ol-infrastructure`).

## Why

MIT Learn is adding self-service email/password changes via Keycloak account
actions (mitodl/mit-learn#3726). With `verify_email` enabled — true in CI, QA and
Production — the address only changes when the user clicks the confirmation link
Keycloak emails them. That click happens entirely inside Keycloak: it does not
return to the application with an authorization code, so Learn has no way to
observe it.

Verified in a local reproduction: the leg after the confirmation click reaches
Learn's callback with only the params Learn itself put in the redirect URI
(`account_action`, `next`) — no `code`, no `kc_action_status`.

Consequence today: after a user confirms a new address, Keycloak has the new
value and Learn keeps the old one. It only converges when the APISIX session
turns over, which is **14 days** (`oidc_session_cookie_lifetime = 60 * 20160`,
with idling/rolling timeouts disabled per hq#8416). Until then Learn shows and
emails the stale address.

MITx Online does not have this problem because Keycloak pushes changes to it over
SCIM (`MITOL_SCIM_KEYCLOAK_BASE_URL` is set in its QA and Production stacks, with
a `keycloak-scim` Vault secret). Learn has no equivalent configuration in any
stack.

## What Learn already has

- SCIM 2.0 server endpoints, live: `/scim/v2/Users`, `/scim/v2/ServiceProviderConfig`
  (via `mitol.scim`, `django_scim`)
- A user adapter that maps the SCIM `emails` attribute onto `User.email`
  (`users.adapters.LearnUserAdapter` → `mitol.scim.adapters.UserAdapter`)
- Learn will not overwrite a SCIM-delivered email from its stale gateway header
  (mitodl/mit-learn#3726 changes `ApisixUserMiddleware` to stop re-applying the
  header's email once a session is established)

So the receiving side is in place. **This has been verified**, not just read off
the code — see _Verifying_ below. What's missing is the push configuration, plus
credentials for it.

## What needs to happen

### 1. Learn side — provision credentials for inbound SCIM

**Already built.** Run once per environment:

```bash
python manage.py provision_scim_client
```

It creates a staff service user (`scim-keycloak`), an OAuth2 application, and a
bearer token bound to that user, then prints the token and the values Keycloak
needs. Idempotent; `--rotate-token` issues a new one, since the token is only
displayed when created.

Why a bearer token and not the client_credentials grant: Learn's SCIM endpoints
are guarded by Learn's own OAuth2 provider, where `OAuth2TokenMiddleware` resolves
the token to a user and `mitol.scim.utils.is_authenticated_predicate` then requires
that user to be active **and staff**. A client_credentials token is issued to the
application rather than a person, so `AccessToken.user` is null and the request is
rejected with a **401** — confirmed by testing, not assumed. So the plugin's auth
type must be **BEARER**.

For reference, the plugin supports `BASIC`, `API_KEY`, `BEARER`,
`CLIENT_CREDENTIALS_GRANT` and `MUTUAL_TLS_CLIENT_AUTH`. Only `BEARER` works here
without further changes on Learn's side.

### 2. Keycloak side — add the remote SCIM target

In the `olapps` realm's scim-for-keycloak admin backend
(`/realms/olapps/scim/admin/backend/scim/v2/…`), add a `RemoteScimProviderConfig`
entry for MIT Learn:

| Field      | Value                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| Base URL   | `https://api.learn.mit.edu/scim/v2/`                                                                          |
| Auth       | Bearer token from step 1                                                                                      |
| Resource   | Users                                                                                                         |
| Operations | at minimum **update** (create/delete optional — Learn creates users from the gateway header on first request) |

Per environment: `https://api.rc.learn.mit.edu/scim/v2/` for QA, and the CI
equivalent.

`ol-infrastructure/scripts/keycloak/export_scim_config.py` already lists
`RemoteScimProviderConfig` as _"Remote SCIM provider targets (MIT Learn, etc.)"_,
so MIT Learn appears to have been anticipated as a target.

### 3. Send the non-compliant payload shape Keycloak already uses

`mitol.scim` is written specifically for scim-for-keycloak's format, and only that
format. From `mitol/scim/adapters.py`:

```python
# scim-for-keycloak sends this as a noncompliant JSON-encoded string
if path is None:
    val = json.loads(value)
```

So a `replace` operation must arrive with **`path` absent/null** and **`value` as a
JSON-encoded string**:

```json
{
  "op": "replace",
  "value": "{\"emails\": [{\"value\": \"new@mit.edu\", \"primary\": true}]}"
}
```

The spec-compliant form — `"path": "emails"` with a list value — makes Learn
return **500** (`AttributeError: 'list' object has no attribute 'items'`). That is
not a bug to fix here; the library is deliberately built for what the plugin
sends. It matters only if the target is ever configured to emit compliant SCIM.

### 4. Verify

After configuring, change a test user's email in Keycloak (either through the
account action flow with confirmation, or directly in admin) and confirm Learn's
`User.email` updates without waiting for a session turnover.

## Scope note

Only `emails` matters for the immediate problem. If the push covers the other
mapped attributes (name, username) that is a bonus — it would also close the
same staleness gap for those, which currently rely on the gateway header.

## What isn't being asked for

Not asking for outbound SCIM (Learn → Keycloak). Learn already writes the email
opt-in attribute directly via the Admin API, and mitodl/ol-infrastructure#5252
provisions the service account for that.

## Verifying

### Learn's receiving side — testable locally, and already verified

A SCIM push is just an authenticated HTTP request, so no Keycloak is needed to
prove Learn handles it. Provision a staff user with an OAuth2 token, then:

```bash
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/scim+json" \
  -d '{
    "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
    "Operations": [
      {"op": "replace", "value": "{\"emails\": [{\"value\": \"new@mit.edu\", \"primary\": true}]}"}
    ]
  }' \
  "http://localhost:8063/scim/v2/Users/<scim_id>"
```

Confirmed locally: returns `200`, `User.email` becomes the pushed address, and a
subsequent request carrying a stale gateway header does **not** revert it.

That second point is a prerequisite: before mitodl/mit-learn#3726, the APISIX
middleware re-applied the header's email on every request and would have undone
any SCIM-delivered value within one request. **That PR must be deployed before
this configuration is useful.**

### The Keycloak push — deployed environments only

The plugin is enterprise-licensed
(`scim-for-keycloak-kc-26.7-4.0.0-enterprise.jar`) and ships only in the
`mitodl/keycloak` image; local development runs upstream Keycloak, which has no
SCIM plugin. So the push configuration itself can only be exercised in CI/QA.

Cleanest first check once configured: change a test user's email directly in
Keycloak admin, bypassing the account-action flow entirely, and confirm Learn's
`User.email` updates. That isolates the push from the rest of the flow.
